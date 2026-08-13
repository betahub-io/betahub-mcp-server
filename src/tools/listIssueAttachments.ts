/**
 * Issue Attachments Tool
 * Lists the files attached to a BetaHub issue (screenshots, video clips, log files,
 * binary files) as downloadable URLs.
 */

import { z } from 'zod';
import { config } from '../config.js';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import { NotFoundError, AccessDeniedError, ApiError } from '../errors.js';
import type { AttachmentType, IssueAttachment } from '../types/betahub.js';
import type { ToolResponse, ListIssueAttachmentsInput } from '../types/mcp.js';

const ATTACHMENT_TYPES: AttachmentType[] = [
  'screenshot',
  'video_clip',
  'log_file',
  'binary_file',
];

// Each type has its own nested collection route under the issue.
const ENDPOINT_SEGMENT: Record<AttachmentType, string> = {
  screenshot: 'screenshots',
  video_clip: 'video_clips',
  log_file: 'log_files',
  binary_file: 'binary_files',
};

const SECTION_HEADING: Record<AttachmentType, string> = {
  screenshot: 'Screenshots',
  video_clip: 'Video Clips',
  log_file: 'Log Files',
  binary_file: 'Binary Files',
};

export const listIssueAttachmentsInputSchema = {
  projectId: z.string().describe('The project ID the issue belongs to'),
  issueId: z
    .string()
    .describe(
      'The issue ID to list attachments for. Accepts either the scoped ID (e.g. "123" or "g-456") or the global ID.'
    ),
  types: z
    .array(z.enum(['screenshot', 'video_clip', 'log_file', 'binary_file']))
    .optional()
    .describe(
      'Restrict the results to these attachment types. Omit to return all four types.'
    ),
};

export const listIssueAttachmentsDefinition = {
  title: 'List Issue Attachments',
  description:
    'List every attachment on a BetaHub issue: screenshots, video clips, log files and binary files ' +
    '(savegames, crash dumps, configs). Returns a download URL for each file — it does NOT return the ' +
    'file contents, so the caller must fetch the URLs itself to actually download anything. The URLs are ' +
    'public CDN links that need no authentication. Also returns the issue\'s BetaHub dashboard URL, ' +
    'so you can link the user to the issue page without a separate lookup.',
  inputSchema: listIssueAttachmentsInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

// Reproduces the backend's `attachment_download_url`: the same CDN URL plus a `?download=`
// marker that a CloudFront viewer-response function turns into Content-Disposition: attachment.
// encodeURIComponent matches Rails' ERB::Util.url_encode on the characters that matter — notably
// it emits %20 for a space, where URLSearchParams would emit a `+` the CDN reads as a literal plus.
//
// Only this marked URL is emitted, never the bare one. Verified against the live CDN:
// BetaHub's blobs are already stored with Content-Disposition: attachment, and the CloudFront
// function is an explicit no-op without the marker — so the bare URL is not an "inline view"
// link and must not be advertised as one. The marker is still worth emitting: it pins the
// filename in the disposition regardless of what a given blob happens to have stored, and
// `download` is excluded from the CDN cache key, so it costs nothing.
function toDownloadUrl(url: string, filename: string | null): string {
  if (!filename) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}download=${encodeURIComponent(filename)}`;
}

// The issue's page on the BetaHub dashboard. Synthesized rather than fetched: the
// dashboard resolves the id through Issue.find_by_global_or_scoped_id, so both the
// scoped ("5") and global ("g-456") forms the caller may pass work verbatim.
function toIssuePageUrl(projectId: string, issueId: string): string {
  const base = config.api.baseUrl.replace(/\/$/, '');
  return `${base}/projects/${projectId}/issues/${issueId}`;
}

// Filenames and descriptions come from whoever reported the bug — including unauthenticated
// submission-form users (ScreenshotPolicy#authorized_to_write_media? grants write to token/IP
// callers and issue reporters). Rendered raw into this report they can forge extra attachment
// entries, complete with a Download line the agent is instructed to fetch. Collapsing line
// breaks is what defeats that: injected content can no longer start a markdown line of its own.
function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

// For free text rendered outside a code span, also defuse link syntax so a crafted string
// cannot present itself as a clickable URL. Mirrors escapeTableCell in aggregateCustomField.ts.
function escapeInlineMarkdown(value: string): string {
  return stripLineBreaks(value).replace(/([[\]])/g, '\\$1');
}

// Inside a code span markdown is inert, so only a stray backtick needs neutralising.
function codeSpan(value: string): string {
  return `\`${stripLineBreaks(value).replace(/`/g, "'")}\``;
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

async function fetchType(
  client: BetaHubApiClient,
  projectId: string,
  issueId: string,
  type: AttachmentType
): Promise<IssueAttachment[]> {
  // These four endpoints return a bare JSON array, not a `{ key: [...] }` envelope.
  const rows = await client.get<IssueAttachment[]>(
    `projects/${projectId}/issues/${issueId}/${ENDPOINT_SEGMENT[type]}.json`
  );
  // Defensive: the type field is rendered server-side, but never trust it to be present.
  return (rows ?? []).map((row) => ({ ...row, type: row.type ?? type }));
}

function renderAttachment(attachment: IssueAttachment, index: number): string {
  const title = attachment.filename
    ? codeSpan(attachment.filename)
    : `(untitled ${attachment.type} #${attachment.id})`;
  let output = `### ${index}. ${title}\n`;

  if (attachment.url) {
    output += `- **Download:** ${toDownloadUrl(attachment.url, attachment.filename)}\n`;
  } else {
    output += `- **No file attached** — nothing to download.\n`;
  }

  // Screenshot#calculate_media_size_bytes sums image.byte_size + layer_a.byte_size, so on an
  // annotated screenshot this figure covers BOTH blobs and is larger than the file you download.
  const sizeIsCombined = Boolean(attachment.layer_a_url);
  output += `- **Size:** ${formatBytes(attachment.size_bytes)}${
    sizeIsCombined ? ' (combined: image + annotation layer)' : ''
  }\n`;
  output += `- **Content type:** ${attachment.content_type ?? 'unknown'}\n`;
  output += `- **Uploaded:** ${attachment.created_at}\n`;
  output += `- **Uploaded by:** ${attachment.user?.name ?? 'unknown'}\n`;

  if (attachment.description) {
    output += `- **Description:** ${escapeInlineMarkdown(attachment.description)}\n`;
  }

  // The annotation overlay is a second image blob, downloadable in its own right.
  if (attachment.layer_a_url) {
    output += `- **Annotation layer:** ${toDownloadUrl(attachment.layer_a_url, attachment.layer_a_filename ?? null)}\n`;
  }

  if (attachment.developer_private) {
    output += `- **Developer-private:** yes (not visible to testers)\n`;
  }

  // ProcessVideoJob transcodes the clip in place, so state decides whether the URL is usable.
  if (attachment.failed) {
    output += `- **Processing failed:** this clip cannot be played — the upload could not be transcoded. Downloading it is unlikely to be useful.\n`;
  } else if (attachment.processing) {
    output += `- **Still processing:** this URL points at the un-transcoded original. Re-check later for the final file.\n`;
  }

  return `${output}\n`;
}

export async function listIssueAttachments(
  { projectId, issueId, types }: ListIssueAttachmentsInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const client = apiClient || getApiClient();
  const selectedTypes = types?.length ? types : ATTACHMENT_TYPES;

  try {
    const results = await Promise.all(
      selectedTypes.map((type) => fetchType(client, projectId, issueId, type))
    );

    const byType = new Map<AttachmentType, IssueAttachment[]>();
    selectedTypes.forEach((type, index) => {
      if (results[index].length > 0) byType.set(type, results[index]);
    });

    // A page link, not a file — labelled apart from the **Download:** links below so a
    // host that fetches every URL it sees does not treat it as a fifth attachment.
    const issuePageLink = `**Issue page:** ${toIssuePageUrl(projectId, issueId)}`;

    const total = results.reduce((sum, rows) => sum + rows.length, 0);
    if (total === 0) {
      return {
        content: [{
          type: 'text',
          text: `No attachments found on issue ${issueId}.\n\n${issuePageLink}\n`,
        }],
      };
    }

    let output = `# Attachments for Issue ${issueId} (Project ${projectId})\n\n`;
    output += `${issuePageLink}\n\n`;
    output += `Found ${total} attachment(s).\n\n`;
    output += `**These are links, not file contents.** Fetch the download URLs to save the files ` +
      `locally; they are public CDN links and need no authentication header.\n\n`;

    // Iterate the canonical order so output is stable regardless of the `types` argument order.
    for (const type of ATTACHMENT_TYPES) {
      const rows = byType.get(type);
      if (!rows) continue;

      output += `## ${SECTION_HEADING[type]} (${rows.length})\n\n`;
      rows.forEach((attachment, index) => {
        output += renderAttachment(attachment, index + 1);
      });
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.statusCode === 404) {
        throw new NotFoundError('Issue', issueId);
      }
      if (error.statusCode === 403) {
        throw new AccessDeniedError('issue', issueId);
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch issue attachments: ${message}`);
  }
}
