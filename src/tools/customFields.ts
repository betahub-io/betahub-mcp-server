/**
 * Custom Fields Tool
 * Lists a project's custom fields, merged across bugs (issue) and suggestions
 * (feature_request) so the AI can discover idents to feed into aggregateCustomField.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import { ApiError, NotFoundError, AccessDeniedError } from '../errors.js';
import type { CustomField, CustomFieldsResponse } from '../types/betahub.js';
import type { ToolResponse, ListCustomFieldsInput } from '../types/mcp.js';

export const listCustomFieldsInputSchema = {
  projectId: z.string().describe('The project ID to list custom fields for'),
};

export const listCustomFieldsDefinition = {
  title: 'List Custom Fields',
  description:
    'List a project\'s custom fields, merged across bugs and suggestions. Use this to discover the ' +
    '`ident` of a field, then pass it to the aggregateCustomField tool. Fields flagged "aggregatable ' +
    'across bugs + suggestions" exist on both entity types and will return combined counts when aggregated.',
  inputSchema: listCustomFieldsInputSchema,
  // Pure read against the BetaHub API: no mutations, repeatable, talks to an external service.
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

// The backend keeps a separate custom-field definition per entity type. We label the two
// aggregatable types in the same vocabulary the aggregation API uses (bugs / suggestions).
const APPLIES_TO_LABEL: Record<string, string> = {
  issue: 'bugs',
  feature_request: 'suggestions',
};

interface MergedField {
  ident: string;
  name: string;
  field_type: string;
  required: boolean;
  appliesTo: Set<string>; // 'issue' | 'feature_request'
}

// Fetch every page of custom fields for a single applies_to value.
async function fetchAllPages(
  client: BetaHubApiClient,
  projectId: string,
  appliesTo: 'issue' | 'feature_request'
): Promise<CustomField[]> {
  const fields: CustomField[] = [];
  const base = `projects/${projectId}/custom_fields.json?applies_to=${appliesTo}`;

  const first = await client.get<CustomFieldsResponse>(base);
  fields.push(...(first.custom_fields ?? []));

  const totalPages = first.pagination?.total_pages ?? 1;
  for (let page = 2; page <= totalPages; page++) {
    const next = await client.get<CustomFieldsResponse>(`${base}&page=${page}`);
    fields.push(...(next.custom_fields ?? []));
  }

  return fields;
}

export async function listCustomFields(
  { projectId }: ListCustomFieldsInput,
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const client = apiClient || getApiClient();

  try {
    const [issueFields, featureRequestFields] = await Promise.all([
      fetchAllPages(client, projectId, 'issue'),
      fetchAllPages(client, projectId, 'feature_request'),
    ]);

    const merged = new Map<string, MergedField>();
    for (const field of [...issueFields, ...featureRequestFields]) {
      const existing = merged.get(field.ident);
      if (existing) {
        existing.appliesTo.add(field.applies_to);
      } else {
        merged.set(field.ident, {
          ident: field.ident,
          name: field.name,
          field_type: field.field_type,
          required: field.required,
          appliesTo: new Set([field.applies_to]),
        });
      }
    }

    if (merged.size === 0) {
      return {
        content: [{ type: 'text', text: 'No custom fields found in this project.' }],
      };
    }

    const fields = Array.from(merged.values());
    // Surface fields usable for cross-type aggregation first, then alphabetically by ident.
    fields.sort((a, b) => {
      const aAgg = isAggregatable(a) ? 0 : 1;
      const bAgg = isAggregatable(b) ? 0 : 1;
      return aAgg - bAgg || a.ident.localeCompare(b.ident);
    });

    let output = `# Custom Fields for Project ${projectId}\n\n`;
    output += `Found ${fields.length} field(s).\n\n`;

    for (const field of fields) {
      const labels = ['issue', 'feature_request']
        .filter((type) => field.appliesTo.has(type))
        .map((type) => APPLIES_TO_LABEL[type]);
      const aggregatable = isAggregatable(field);

      output += `## \`${field.ident}\` — ${field.name}\n`;
      output += `- **Type:** ${field.field_type}\n`;
      output += `- **Required:** ${field.required ? 'yes' : 'no'}\n`;
      output += `- **Applies to:** ${labels.join(', ')}\n`;
      output += aggregatable
        ? `- **Aggregatable across bugs + suggestions:** ✅ yes\n\n`
        : `- **Aggregatable across bugs + suggestions:** ❌ no (only present for ${labels.join(', ')})\n\n`;
    }

    output += `---\n`;
    output += `**Usage:** Pass an \`ident\` to the \`aggregateCustomField\` tool to rank bugs + suggestions by ` +
      `that field's values (e.g. top contributors by \`roblox_id\`). Only fields aggregatable across both ` +
      `return combined counts; others count just the type they apply to.\n`;

    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.statusCode === 404) {
        throw new NotFoundError('Project', projectId);
      }
      if (error.statusCode === 403) {
        throw new AccessDeniedError('project', projectId);
      }
    }
    throw new Error(
      `Failed to fetch custom fields: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function isAggregatable(field: MergedField): boolean {
  return field.appliesTo.has('issue') && field.appliesTo.has('feature_request');
}
