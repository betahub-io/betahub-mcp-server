/**
 * Factory functions for generating test data
 */

import type { Project, FeatureRequest, User, TokenInfo, Pagination, Issue, Release, DownloadLink, IssueTag, CustomField, CustomFieldAggregationRow, IssueAttachment, AttachmentType } from '../../types/betahub.js';

export function createUser(overrides?: Partial<User>): User {
  return {
    name: 'Test User',
    email: 'test@example.com',
    id: 'user-123',
    avatar_url: 'https://example.com/avatar.jpg',
    ...overrides,
  };
}

export function createProject(overrides?: Partial<Project>): Project {
  return {
    id: 'pr-test-123',
    name: 'Test Project',
    description: 'A test project for unit tests',
    url: 'https://app.betahub.io/projects/pr-test-123',
    member_count: 5,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    ...overrides,
  };
}

export function createFeatureRequest(overrides?: Partial<FeatureRequest>): FeatureRequest {
  return {
    id: 'fr-test-456',
    title: 'Test Feature Request',
    description: 'This is a test feature request',
    status: 'pending',
    votes: 10,
    voted: false,
    is_duplicate: false,
    duplicates_count: 0,
    user: createUser(),
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    url: 'https://app.betahub.io/feature-requests/fr-test-456',
    ...overrides,
  };
}

export function createTokenInfo(overrides?: Partial<TokenInfo>): TokenInfo {
  return {
    valid: true,
    token_type: 'personal_access_token',
    user: createUser(),
    expires_at: '2025-12-31T23:59:59Z',
    ...overrides,
  };
}

export function createPagination(overrides?: Partial<Pagination>): Pagination {
  return {
    current_page: 1,
    total_pages: 1,
    total_count: 10,
    per_page: 25,
    ...overrides,
  };
}

export function createProjectsResponse(count = 3) {
  return {
    projects: Array.from({ length: count }, (_, i) =>
      createProject({
        id: `pr-test-${i}`,
        name: `Test Project ${i}`
      })
    ),
    total_count: count,
  };
}

export function createFeatureRequestsResponse(count = 5, page = 1) {
  const perPage = 25;
  return {
    feature_requests: Array.from({ length: count }, (_, i) =>
      createFeatureRequest({
        id: `fr-test-${i}`,
        title: `Feature Request ${i}`
      })
    ),
    pagination: createPagination({
      current_page: page,
      total_pages: Math.ceil(count / perPage),
      total_count: count,
      per_page: perPage,
    }),
    sort: 'top',
    project_id: 'pr-test-123',
  };
}

export function createIssue(overrides?: Partial<Issue>): Issue {
  return {
    id: 'issue-test-789',
    title: 'Test Issue',
    description: 'This is a test issue',
    status: 'open',
    priority: 'medium',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    score: 5,
    steps_to_reproduce: [
      { step: 'Open the app' },
      { step: 'Click on login' },
      { step: 'App crashes' }
    ],
    assigned_to: {
      id: 'user-456',
      name: 'Developer'
    },
    reported_by: {
      id: 'user-789',
      name: 'Reporter'
    },
    potential_duplicate: null,
    url: 'https://app.betahub.io/issues/issue-test-789',
    ...overrides,
  };
}

export function createIssuesResponse(count = 5, page = 1) {
  const perPage = 20;
  return {
    issues: Array.from({ length: count }, (_, i) =>
      createIssue({
        id: `issue-test-${i}`,
        title: `Issue ${i}`
      })
    ),
    pagination: createPagination({
      current_page: page,
      total_pages: Math.ceil(count / perPage),
      total_count: count,
      per_page: perPage,
    }),
  };
}

export function createDownloadLink(overrides?: Partial<DownloadLink>): DownloadLink {
  return {
    platform: 'windows',
    url: 'https://example.com/download/game-v1.0.0-windows.zip',
    ...overrides,
  };
}

export function createRelease(overrides?: Partial<Release>): Release {
  return {
    id: 123,
    project_id: 6,
    label: 'v1.0.0',
    summary: 'Test release summary',
    description: 'Test release description',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    download_link: 'https://example.com/download/game-v1.0.0.zip',
    dynamically_created: false,
    ...overrides,
  };
}

export function createIssueTag(overrides?: Partial<IssueTag>): IssueTag {
  return {
    id: 1,
    name: 'Test Tag',
    color: '#FF0000',
    description: null,
    parent_tag_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    ...overrides,
  };
}

export function createIssueTagsResponse(count = 3) {
  return {
    tags: Array.from({ length: count }, (_, i) =>
      createIssueTag({
        id: i + 1,
        name: `Tag ${i + 1}`
      })
    ),
  };
}

export function createCustomField(overrides?: Partial<CustomField>): CustomField {
  return {
    id: 1,
    ident: 'roblox_id',
    name: 'Roblox ID',
    field_type: 'text',
    required: false,
    tester_settable: true,
    tester_viewable: true,
    options: null,
    applies_to: 'issue',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    ...overrides,
  };
}

export function createCustomFieldsResponse(
  fields: CustomField[],
  paginationOverrides?: Partial<Pagination>
) {
  return {
    custom_fields: fields,
    pagination: createPagination({
      total_count: fields.length,
      ...paginationOverrides,
    }),
    project_id: 123,
    applies_to: fields[0]?.applies_to ?? 'issue',
  };
}

export function createCustomFieldAggregationRow(
  overrides?: Partial<CustomFieldAggregationRow>
): CustomFieldAggregationRow {
  const by_type = { bugs: 0, suggestions: 0, ...overrides?.by_type };
  return {
    value: '123456789',
    count: by_type.bugs + by_type.suggestions,
    ...overrides,
    by_type,
  };
}

export function createCustomFieldAggregationResponse(
  field: string,
  rows: CustomFieldAggregationRow[]
) {
  return { field, results: rows };
}

export function createIssueAttachment(
  type: AttachmentType,
  overrides?: Partial<IssueAttachment>
): IssueAttachment {
  const defaultsByType: Record<AttachmentType, Partial<IssueAttachment>> = {
    screenshot: {
      filename: 'crash.png',
      url: 'https://storage.betahub.io/abc123',
      content_type: 'image/png',
      description: null,
      layer_a_url: null,
      layer_a_filename: null,
    },
    video_clip: {
      filename: 'repro.mp4',
      url: 'https://storage.betahub.io/vid456',
      content_type: 'video/mp4',
      processing: false,
      processed: true,
      failed: false,
    },
    log_file: {
      filename: 'player.log',
      url: 'https://storage.betahub.io/log789',
      content_type: 'text/plain',
    },
    binary_file: {
      filename: 'savegame.dat',
      url: 'https://storage.betahub.io/bin000',
      content_type: 'application/octet-stream',
    },
  };

  return {
    id: 1,
    type,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    size_bytes: 1024,
    developer_private: false,
    user: { id: 'user-1', name: 'Test Reporter' },
    filename: null,
    url: null,
    content_type: null,
    ...defaultsByType[type],
    ...overrides,
  };
}
