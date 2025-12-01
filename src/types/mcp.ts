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
  status?: 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'duplicate';
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
}

export interface SearchSuggestionsInput {
  projectId: string;
  query?: string;
  skipIds?: string;
  scopedId?: string;
}

export interface ListIssuesInput {
  projectId: string;
  status?: 'new' | 'in_progress' | 'needs_more_info' | 'resolved' | 'closed' | 'wont_fix';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  page?: number;
  perPage?: number;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  tagIds?: string;
}

export interface ListIssueTagsInput {
  projectId: string;
}

export interface SearchIssuesInput {
  projectId: string;
  query?: string;
  skipIds?: string;
  scopedId?: string;
}

export interface ListReleasesInput {
  projectId: string;
}