import { vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createTokenInfo, createProject, createFeatureRequest } from './helpers/factories.js';

// Mock server for HTTP requests
export const server = setupServer(
  // Auth verification endpoint
  http.post('https://app.betahub.io/auth/verify', () => {
    return HttpResponse.json(createTokenInfo({
      valid: true,
      token_type: 'personal_access_token',
      user: { name: 'Test User', email: 'test@example.com' },
      expires_at: '2025-12-31T23:59:59Z'
    }));
  }),

  // Projects endpoint
  http.get('https://app.betahub.io/projects.json', () => {
    return HttpResponse.json({
      projects: [
        createProject({
          id: 'pr-test-123',
          name: 'Test Project',
          description: 'A test project for unit tests',
          member_count: 5
        }),
        createProject({
          id: 'pr-test-456',
          name: 'Another Project',
          member_count: 10
        })
      ]
    });
  }),

  // Feature requests endpoint
  http.get('https://app.betahub.io/projects/:projectId/feature_requests.json', ({ params, request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const sort = url.searchParams.get('sort') || 'top';
    const projectId = params.projectId as string;

    return HttpResponse.json({
      feature_requests: [
        createFeatureRequest({
          id: 'fr-test-456',
          title: 'Test Feature Request',
          description: 'This is a test feature request',
          status: 'pending',
          votes: 10
        }),
        createFeatureRequest({
          id: 'fr-test-789',
          title: 'Another Feature',
          votes: 5
        })
      ],
      pagination: {
        current_page: parseInt(page),
        total_pages: 3,
        total_count: 60,
        per_page: 25
      },
      sort: sort,
      project_id: projectId
    });
  })
);

// Start server before all tests
export function setupTests() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

// Utility to override handlers for specific tests
export function mockApiResponse(endpoint: string, response: any, status = 200) {
  server.use(
    http.get(`https://app.betahub.io${endpoint}`, () => {
      return HttpResponse.json(response, { status });
    })
  );
}

export function mockApiError(endpoint: string, status = 500) {
  server.use(
    http.get(`https://app.betahub.io${endpoint}`, () => {
      return new HttpResponse(null, { status });
    })
  );
}