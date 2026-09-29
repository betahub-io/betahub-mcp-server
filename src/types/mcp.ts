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
  status?: 'open' | 'in_progress' | 'needs_more_info' | 'resolved' | 'closed' | 'wont_fix';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  page?: number;
  perPage?: number;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  tagIds?: string;
  fields?: string[];
  maxFieldLength?: number;
}

export interface ListIssueTagsInput {
  projectId: string;
}

export interface SearchIssuesInput {
  projectId: string;
  query?: string;
  skipIds?: string;
  scopedId?: string;
  fields?: string[];
  maxFieldLength?: number;
}

export interface ListReleasesInput {
  projectId: string;
}

export interface FindSimilarIssuesInput {
  projectId: string;
  issueId: string;
  limit?: number;
  includeArchived?: boolean;
  fields?: string[];
  maxFieldLength?: number;
}

export interface ListIssueAttachmentsInput {
  projectId: string;
  issueId: string;
  types?: Array<'screenshot' | 'video_clip' | 'log_file' | 'binary_file'>;
}

export interface ListCustomFieldsInput {
  projectId: string;
}

export interface AggregateCustomFieldInput {
  projectId: string;
  field: string;
  types?: 'bugs' | 'suggestions';
  from?: string;
  to?: string;
  status?: string;
  limit?: number;
}
// Dashboard filters shared by the sentiment tools.
export interface SentimentFiltersInput {
  from?: string;
  to?: string;
  category?: 'positive' | 'negative' | 'neutral' | 'toxic' | 'excited' | 'frustrated';
  channelIds?: string[];
  roleNames?: string[];
  word?: string;
}

export interface GetSentimentOverviewInput extends SentimentFiltersInput {
  projectId: string;
}

export interface ListSentimentInsightsInput {
  projectId: string;
  topicId?: number;
}

export interface ListSentimentTopicsInput extends SentimentFiltersInput {
  projectId: string;
  limit?: number;
}

export interface ListSentimentMessagesInput extends SentimentFiltersInput {
  projectId: string;
  topicId?: number;
  insightId?: number;
  query?: string;
  page?: number;
}

export interface GetSteamScannerInput {
  projectId: string;
  range?: 'd1' | 'd7' | 'd30';
  from?: string;
  to?: string;
}

export interface ListSteamThreadsInput {
  projectId: string;
  forumId?: number;
  classification?: 'unclassified' | 'bug' | 'suggestion' | 'neither' | 'skipped';
  outcome?: 'pending' | 'created' | 'linked' | 'waiting' | 'none' | 'unlinked';
  query?: string;
  range?: 'd1' | 'd7' | 'd30' | 'all';
  page?: number;
}
