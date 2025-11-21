/**
 * Releases tool implementation for BetaHub MCP Server
 */

import { z } from 'zod';
import { getApiClient } from '../api/client.js';
import { config } from '../config.js';
import { NotFoundError, AccessDeniedError } from '../errors.js';
import type { Release, ReleasesResponse } from '../types/betahub.js';
import type { ListReleasesInput, ToolResponse } from '../types/mcp.js';

export const listReleasesInputSchema = {
  projectId: z.string().describe('The project ID to fetch releases from'),
};

export const listReleasesDefinition = {
  title: 'List Project Releases',
  description: 'List all releases for a BetaHub project',
  inputSchema: listReleasesInputSchema,
};

export async function listReleases({ projectId }: ListReleasesInput): Promise<ToolResponse> {
  const client = getApiClient();

  try {
    const endpoint = `projects/${projectId}/releases.json`;
    const response = await client.get<Release[]>(endpoint);

    if (!response || !Array.isArray(response)) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            releases: [],
            total_count: 0,
            project_id: projectId,
            message: 'No releases found for this project',
          }, null, 2),
        }],
      };
    }

    const formattedReleases = response.map((release) => ({
      id: release.id,
      label: release.label,
      summary: release.summary,
      description: release.description,
      created_at: release.created_at,
      updated_at: release.updated_at,
      download_link: release.download_link,
      dynamically_created: release.dynamically_created,
      url: `${config.api.baseUrl.replace(/\/$/, '')}/projects/${projectId}/releases/${release.id}`,
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(
          {
            releases: formattedReleases,
            total_count: formattedReleases.length,
            project_id: projectId,
          },
          null,
          2
        ),
      }],
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        throw new NotFoundError('Project', projectId);
      }
      if (error.message.includes('403')) {
        throw new AccessDeniedError('project', projectId);
      }
    }
    throw new Error(
      `Failed to fetch releases: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}