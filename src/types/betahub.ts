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