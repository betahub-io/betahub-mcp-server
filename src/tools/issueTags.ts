/**
 * Issue Tags Tool
 * Lists issue tags from a BetaHub project
 */

import { z } from 'zod';
import { getApiClient } from '../api/client.js';
import { NotFoundError, AccessDeniedError } from '../errors.js';
import type { IssueTag, IssueTagsResponse } from '../types/betahub.js';
import type { ToolResponse, ListIssueTagsInput } from '../types/mcp.js';

export const listIssueTagsInputSchema = {
  projectId: z.string().describe('The project ID to fetch issue tags from'),
};

export const listIssueTagsDefinition = {
  title: 'List Issue Tags',
  description: 'List all issue tags from a BetaHub project. Tags are used to categorize and filter issues.',
  inputSchema: listIssueTagsInputSchema,
};

export async function listIssueTags({
  projectId,
}: ListIssueTagsInput): Promise<ToolResponse> {
  const client = getApiClient();

  try {
    const endpoint = `projects/${projectId}/issue_tags.json`;
    const response = await client.get<IssueTagsResponse>(endpoint);

    if (!response.tags || response.tags.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No issue tags found in this project.',
          },
        ],
      };
    }

    // Group tags by parent/child relationships
    const parentTags = response.tags.filter((tag) => !tag.parent_tag_id);
    const childTagsByParent = response.tags
      .filter((tag) => tag.parent_tag_id)
      .reduce((acc, tag) => {
        const parentId = tag.parent_tag_id!;
        if (!acc[parentId]) acc[parentId] = [];
        acc[parentId].push(tag);
        return acc;
      }, {} as Record<number, IssueTag[]>);

    let output = `# Issue Tags for Project ${projectId}\n\n`;
    output += `Found ${response.tags.length} tag(s)\n\n`;

    // Display parent tags with their children
    for (const parentTag of parentTags) {
      output += `## ${parentTag.name} (ID: ${parentTag.id})\n`;
      output += `- **Color:** ${parentTag.color}\n`;
      if (parentTag.description) {
        output += `- **Description:** ${parentTag.description}\n`;
      }

      // Display child tags if any
      const children = childTagsByParent[parentTag.id];
      if (children && children.length > 0) {
        output += `- **Sub-tags:**\n`;
        for (const child of children) {
          output += `  - ${child.name} (ID: ${child.id})`;
          if (child.description) {
            output += ` - ${child.description}`;
          }
          output += `\n`;
        }
      }
      output += `\n`;
    }

    // Check for orphaned child tags
    const orphanedChildren = response.tags.filter(
      (tag) => tag.parent_tag_id && !parentTags.some((p) => p.id === tag.parent_tag_id)
    );

    if (orphanedChildren.length > 0) {
      output += `## ⚠️ Orphaned Tags\n`;
      output += `The following tags reference non-existent parents:\n`;
      for (const tag of orphanedChildren) {
        output += `- ${tag.name} (ID: ${tag.id}, Missing Parent ID: ${tag.parent_tag_id})\n`;
      }
      output += `\n`;
    }

    output += `\n---\n`;
    output += `**Usage:** Use tag IDs with the \`listIssues\` tool's \`tagIds\` parameter to filter issues by tags.\n`;
    output += `Example: \`tagIds: "1,2,3"\` to filter issues with tags 1, 2, or 3.\n`;

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
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
      `Failed to fetch issue tags: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
