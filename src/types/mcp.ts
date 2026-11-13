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
  status?: 'open' | 'under_review' | 'planned' | 'started' | 'completed' | 'declined' | 'duplicate';
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

// Orders issues.json offers: `id` reads every bug once, `heat` puts the hottest first.
export const ISSUE_LIST_SORTS = ['id', 'heat'] as const;
export type IssueListSort = typeof ISSUE_LIST_SORTS[number];
export const DEFAULT_ISSUE_LIST_SORT: IssueListSort = 'id';

export interface ListIssuesInput {
  projectId: string;
  status?: 'open' | 'in_progress' | 'needs_more_info' | 'resolved' | 'closed' | 'wont_fix' | 'duplicate'
    | 'pending_moderation';
  priority?: IssuePriority;
  page?: number;
  perPage?: number;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  tagIds?: string;
  sort?: IssueListSort;
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

export type IssuePriority = 'low' | 'medium' | 'high' | 'critical' | 'blocker';

export interface UpdateIssueInput {
  projectId: string;
  issueId: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: IssuePriority;
  assignedToId?: number | null;
  releaseId?: number;
  tagIds?: Array<string | number>;
  customFields?: Record<string, unknown>;
}

// One bug, no other input: archive, unarchive, unmark duplicate.
export interface IssueRefInput {
  projectId: string;
  issueId: string;
}

export interface MergeIssuesInput {
  projectId: string;
  targetIssueId: string;
  duplicateIssueId: string;
}

export interface UndoMergeIssuesInput {
  projectId: string;
  targetIssueId: string;
  mergedIssueId: string;
  previousStatus: string;
}

export interface ResolveDuplicateSuggestionInput {
  projectId: string;
  issueId: string;
  decision: 'confirm' | 'reject';
}

export interface BulkUpdateIssuesInput {
  projectId: string;
  issueIds: number[];
  status?: string;
  priority?: IssuePriority;
  releaseId?: number;
  assignedToId?: number | null;
}

// The public workflow a coding agent may set; moderation and duplicates have tools of their own.
export type SuggestionWorkflowStatus = 'open' | 'under_review' | 'planned' | 'started' | 'completed' | 'declined';

export interface SetSuggestionStatusInput {
  projectId: string;
  suggestionId: string;
  status: SuggestionWorkflowStatus;
}

export interface ModerateSuggestionInput {
  projectId: string;
  suggestionId: string;
  decision: 'approve' | 'reject' | 'restore';
}

export interface MergeSuggestionsInput {
  projectId: string;
  targetSuggestionId: string;
  duplicateSuggestionId: string;
}

export interface UndoMergeSuggestionsInput {
  projectId: string;
  targetSuggestionId: string;
  mergedSuggestionId: string;
  previousStatus: string;
}
