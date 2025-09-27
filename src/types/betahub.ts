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
  | string[]  // Array of titles (default response)
  | FeatureRequest  // Single feature request (scoped_id search)
  | {  // Full search response with feature requests
      feature_requests: FeatureRequest[];
      has_more?: boolean;
    };

export interface Issue {
  id: string;
  title: string;
  description: string;
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  score?: number;
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
  | string[]  // Array of titles (default response)
  | Issue  // Single issue (scoped_id search)
  | {  // Full search response with issues
      issues: Issue[];
      has_more?: boolean;
    };