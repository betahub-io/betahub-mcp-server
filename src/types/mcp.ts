/**
 * Type definitions for MCP-related structures
 */

export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export interface ListProjectsInput {
  // No parameters required
}

export interface ListSuggestionsInput {
  projectId: string;
  sort?: 'top' | 'new' | 'all' | 'moderation' | 'rejected' | 'muted' | 'duplicates';
  page?: number;
  limit?: number;
}