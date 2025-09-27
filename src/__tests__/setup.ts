import { vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock server for HTTP requests
export const server = setupServer(
  // Default handlers for common endpoints
  http.post('https://app.betahub.io/auth/verify', () => {
    return HttpResponse.json({
      valid: true,
      tokenType: 'personal_access_token',
      user: { name: 'Test User', email: 'test@example.com' },
      expires: '2024-12-31T23:59:59Z'
    });
  }),

  http.get('https://app.betahub.io/api/projects', () => {
    return HttpResponse.json({
      code: 200,
      data: {
        projects: [
          {
            id: 'pr-test-123',
            name: 'Test Project',
            description: 'A test project for unit tests',
            membersCount: 5,
            createdAt: new Date().toISOString()
          }
        ]
      }
    });
  }),

  http.get('https://app.betahub.io/api/projects/:projectId/suggestions', ({ params, request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const limit = url.searchParams.get('limit') || '25';

    return HttpResponse.json({
      code: 200,
      data: {
        suggestions: [
          {
            id: 's-test-456',
            title: 'Test Feature Request',
            description: 'This is a test feature request',
            status: 'pending',
            upvotes: 10,
            downvotes: 2,
            commentsCount: 5,
            user: {
              name: 'Test User',
              email: 'user@test.com'
            },
            createdAt: new Date().toISOString()
          }
        ],
        meta: {
          page: parseInt(page),
          totalPages: 3,
          totalCount: 60,
          limit: parseInt(limit)
        }
      }
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