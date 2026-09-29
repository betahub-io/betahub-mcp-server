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
// Sentiment analysis (projects/:id/sentiments/*.json). Ratings are on a 1-5 scale and null when
// there is nothing to rate. Channel values are Discord channel ids or "cf-<forum id>" for Steam.
export type SentimentCategory = 'positive' | 'negative' | 'neutral' | 'toxic' | 'excited' | 'frustrated';

export interface DateRange {
  from: string;
  to: string;
}

export interface SentimentChannel {
  value: string;
  name: string;
}

export interface SentimentOverviewResponse {
  date_range: DateRange;
  message_count: number;
  average_rating: number | null;
  categories: Array<{ category: SentimentCategory; count: number }>;
  top_words: Array<{ word: string; count: number }>;
  trend: {
    dates: string[];
    message_count: number[];
    average_rating: Array<number | null>;
    net_sentiment: Array<number | null>;
    frustration_share: Array<number | null>;
    categories: Record<SentimentCategory, number[]>;
  };
  channels: SentimentChannel[];
  ai_summary: string | null;
}

export interface SentimentInsight {
  id: number;
  category: 'info' | 'warning' | 'danger';
  phrase: string;
  reasoning: string | null;
  confidence: string | null;
  trend: string | null;
  signal_strength: number | null;
  matching_count: number | null;
  evidence_count: number;
  keywords: string[];
  created_at: string;
}

export interface SentimentInsightsResponse {
  topic: { id: number; title: string } | null;
  run: {
    status: 'success' | 'empty' | 'failed';
    created_at: string;
    summary: string | null;
    empty_reason: string | null;
  } | null;
  insights: SentimentInsight[];
}

export interface SentimentTopic {
  id: number | null;
  title: string;
  mentions: number;
  previous_mentions: number;
  trend: string;
  change_percentage: number | null;
  sentiment_distribution: Record<string, number>;
  sentiment_percentages: Record<string, number>;
  average_rating: number | null;
  previous_average_rating: number | null;
  rating_change_percentage: number | null;
}

export interface SentimentTopicsResponse {
  date_range: DateRange;
  total_topics_count: number;
  topics: SentimentTopic[];
}

export interface SentimentMessage {
  id: number;
  text: string;
  category: SentimentCategory;
  confidence: number | null;
  key_phrases: string[];
  explanation: string | null;
  language: string | null;
  posted_at: string;
  channel: SentimentChannel;
  topic: { id: number; title: string } | null;
  thread_url: string | null;
}

export interface SentimentMessagesResponse {
  messages: SentimentMessage[];
  pagination: Pagination;
}

// Steam discussions scanner (projects/:id/steam.json, projects/:id/steam/threads.json).
export interface SteamCrawlRun {
  id: number;
  status: 'running' | 'finished' | 'blocked' | 'failed';
  started_at: string;
  finished_at: string | null;
  pages_fetched: number | null;
  stats: Record<string, number>;
  error: string | null;
}

export interface SteamThreadCounts {
  threads: number;
  bugs: number;
  suggestions: number;
}

export interface SteamScannerResponse {
  source: {
    name: string;
    app_id: string;
    hub_url: string;
    status: 'idle' | 'crawling' | 'blocked' | 'failed' | 'disconnected';
    last_crawl_at: string | null;
    suggestion_mentions_threshold: number;
    store_post_text: boolean;
  };
  range: { key: string; from: string; to: string };
  activity: {
    threads: number;
    bugs: number;
    linked: number;
    suggestions: number;
    waiting: number;
    none: number;
  };
  waiting_suggestions: Array<{ thread_id: number; title: string; url: string; mentions: number }>;
  forums: Array<{
    id: number;
    name: string;
    url: string;
    channel_value: string;
    last_24h: SteamThreadCounts;
    last_7d: SteamThreadCounts;
    newest_posted_at: string | null;
  }>;
  current_crawl: SteamCrawlRun | null;
  crawl_history: SteamCrawlRun[];
}

export type SteamThreadClassification = 'unclassified' | 'bug' | 'suggestion' | 'neither' | 'skipped';
export type SteamThreadOutcome = 'pending' | 'created' | 'linked' | 'waiting' | 'none' | 'unlinked';

export interface SteamThread {
  id: number;
  external_id: string;
  title: string;
  generated_title: string | null;
  url: string;
  forum: { id: number; name: string };
  posted_at: string | null;
  last_activity_at: string | null;
  reply_count: number | null;
  pinned: boolean | null;
  classification: SteamThreadClassification;
  classification_reason: string | null;
  confidence: number | null;
  outcome: SteamThreadOutcome;
  unlinked_at: string | null;
  record: {
    type: 'issue' | 'feature_request';
    id: number;
    scoped_id?: string | null;
    title: string;
    url: string;
  } | null;
}

export interface SteamThreadsResponse {
  threads: SteamThread[];
  pagination: Pagination;
}
