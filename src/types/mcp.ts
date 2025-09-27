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

export interface SearchSuggestionsInput {
  projectId: string;
  query?: string;
  skipIds?: string;
  partial?: boolean;
  scopedId?: string;
}

export interface ListIssuesInput {
  projectId: string;
  status?: 'new' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  page?: number;
  perPage?: number;
}

export interface SearchIssuesInput {
  projectId: string;
  query?: string;
  skipIds?: string;
  partial?: boolean;
  scopedId?: string;
}