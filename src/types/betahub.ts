/**
 * Type definitions for BetaHub API responses
 */

export interface User {
  name: string;
  email: string;
  id?: string;
  avatar_url?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  url?: string;
  member_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface FeatureRequest {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'duplicate';
  votes: number;
  voted?: boolean;
  is_duplicate?: boolean;
  duplicates_count?: number;
  user: User;
  created_at: string;
  updated_at?: string;
  url?: string;
}

export interface Pagination {
  current_page: number;
  total_pages: number;
  total_count: number;
  per_page: number;
}

export interface ProjectsResponse {
  projects: Project[];
  total_count?: number;
}

export interface FeatureRequestsResponse {
  feature_requests: FeatureRequest[];
  pagination: Pagination;
  sort: string;
  project_id: string;
}

export interface TokenInfo {
  valid: boolean;
  token_type: 'personal_access_token' | 'project_auth_token' | 'jwt';
  user?: User;
  project?: Project;
  expires_at?: string;
  error?: string;
}

export type SortOrder = 'top' | 'new' | 'all' | 'moderation' | 'rejected' | 'muted' | 'duplicates';

export type FeatureRequestSearchResponse =
  | FeatureRequestsResponse  // Full search response (query search) - same format as index
  | FeatureRequest;  // Single feature request (scoped_id search)

export interface Issue {
  id: string;
  scoped_id?: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'needs_more_info' | 'resolved' | 'closed' | 'wont_fix';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  // The API serializes the issue's own score column as a decimal string (e.g. "0.78").
  score?: number | string;
  steps_to_reproduce?: Array<{
    step: string;
  }>;
  assigned_to?: {
    id: string;
    name: string;
  };
  reported_by?: {
    id: string;
    name: string;
  };
  potential_duplicate?: any;
  url: string;
  token?: string;
}

export interface IssuesResponse {
  issues: Issue[];
  pagination: Pagination;
}

export type IssueSearchResponse =
  | IssuesResponse  // Full search response (query search) - same format as index
  | Issue;  // Single issue (scoped_id search)

export interface DownloadLink {
  platform: string;
  url: string;
}

export interface Release {
  id: number;
  project_id: number;
  label: string;
  summary: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  download_link: string | null;
  dynamically_created: boolean;
}

export interface ReleasesResponse {
  releases: Release[];
  total_count?: number;
}

export interface IssueTag {
  id: number;
  name: string;
  color: string;
  description: string | null;
  parent_tag_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface IssueTagsResponse {
  tags: IssueTag[];
}

// The find_similar endpoint returns the full issue object (minus attachments) plus a
// top-level `similarity_score` (the vector-similarity value), distinct from the issue's
// own `score` column.
export interface SimilarIssue extends Issue {
  similarity_score: number;
}

export interface FindSimilarIssuesResponse {
  issues: SimilarIssue[];
}

export type AttachmentType = 'screenshot' | 'video_clip' | 'log_file' | 'binary_file';

// The four per-issue media endpoints (screenshots / video_clips / log_files / binary_files)
// each render a standardized attachment shape, and each returns a BARE ARRAY rather than the
// `{ key: [...] }` envelope every other endpoint this client consumes uses.
//
// `url` is the inline CloudFront URL (unsigned, no expiry). Appending `?download=<filename>`
// makes the CDN serve it with Content-Disposition: attachment. `url`/`filename` are null when
// the underlying blob is not attached.
export interface IssueAttachment {
  id: number;
  type: AttachmentType;
  created_at: string;
  updated_at: string;
  filename: string | null;
  url: string | null;
  content_type: string | null;
  size_bytes: number | null;
  developer_private: boolean;
  // Nulled by the API when the caller may not see the issue's reporter.
  // `id` is serialized as a number by the media jbuilders (unlike Issue#id elsewhere).
  user: { id: string | number; name: string } | null;
  // Screenshots only: `layer_a` is the annotation overlay, a separate image blob.
  description?: string | null;
  layer_a_url?: string | null;
  layer_a_filename?: string | null;
  // Video clips only: ProcessVideoJob transcodes `video` in place, so a clip that is still
  // processing exposes the un-transcoded original, and a failed one is attached but unplayable.
  processing?: boolean;
  processed?: boolean;
  failed?: boolean;
}

// A custom field definition. Token-based callers (FormUser / Discord bot) receive a limited
// subset of properties (no id, options, tester_viewable, or timestamps), but `ident` — the
// key aggregation selects on — is always present. Hence id/options/timestamps are optional.
export interface CustomField {
  id?: number;
  ident: string;
  name: string;
  field_type: string;
  required: boolean;
  tester_settable?: boolean;
  tester_viewable?: boolean;
  options?: Record<string, unknown> | null;
  applies_to: 'issue' | 'feature_request' | 'ticket';
  created_at?: string;
  updated_at?: string;
}

export interface CustomFieldsResponse {
  custom_fields: CustomField[];
  // Backward-compatible alias for custom_fields, only present when applies_to is "issue".
  custom_issue_fields?: CustomField[];
  pagination: Pagination;
  project_id: number;
  applies_to: string;
}

// A single aggregation bucket: a custom field value with its total occurrence count and a
// per-type breakdown. `by_type` always carries both keys (zero when a type is absent).
export interface CustomFieldAggregationRow {
  value: string;
  count: number;
  by_type: {
    bugs: number;
    suggestions: number;
  };
}

export interface CustomFieldAggregationResponse {
  field: string;
  results: CustomFieldAggregationRow[];
}