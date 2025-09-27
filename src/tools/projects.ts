/**
 * Projects tool implementation for BetaHub MCP Server
 */

import { getApiClient } from '../api/client.js';
import { config } from '../config.js';
import type { Project, ProjectsResponse } from '../types/betahub.js';
import type { ListProjectsInput, ToolResponse } from '../types/mcp.js';

export const listProjectsDefinition = {
  title: 'List BetaHub Projects',
  description: 'List all projects accessible to the authenticated user',
  inputSchema: {},
};

export async function listProjects(_input?: ListProjectsInput): Promise<ToolResponse> {
  const client = getApiClient();

  try {
    const response = await client.get<ProjectsResponse | Project[]>('projects.json');

    const projects = Array.isArray(response)
      ? response
      : 'projects' in response
        ? response.projects
        : [];

    const formattedProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      url: project.url || `${config.api.baseUrl}projects/${project.id}`,
      member_count: project.member_count || 0,
      created_at: project.created_at,
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(
          {
            projects: formattedProjects,
            total_count: formattedProjects.length,
          },
          null,
          2
        ),
      }],
    };
  } catch (error) {
    throw new Error(
      `Failed to fetch projects: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}