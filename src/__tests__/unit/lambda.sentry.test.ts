/**
 * Unit tests for Sentry error reporting in the Lambda handler.
 *
 * Scope note: this is handler-level reporting only. Errors thrown inside MCP tools
 * never reach the handler — the SDK catches them in tool dispatch and converts them
 * to `isError` results — so these tests deliberately cover crashes, not tool failures.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sentryMock = {
  init: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
};

vi.mock('@sentry/aws-serverless', () => sentryMock);

function createEvent(overrides: Record<string, any> = {}) {
  return {
    version: '2.0',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer pat-test-token-123',
    },
    requestContext: { http: { method: 'POST', path: '/mcp' } },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    isBase64Encoded: false,
    ...overrides,
  };
}

// The handler reads SENTRY_DSN at module scope, so every test needs a fresh module graph.
async function loadHandler(dsn?: string) {
  vi.resetModules();
  if (dsn === undefined) {
    delete process.env.SENTRY_DSN;
  } else {
    process.env.SENTRY_DSN = dsn;
  }
  return (await import('../../lambda.js')).handler;
}

describe('Lambda Sentry reporting', () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.clearAllMocks();
    sentryMock.flush.mockResolvedValue(true);
  });

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalDsn;
    }
  });

  describe('initialization', () => {
    it('does not initialize Sentry when SENTRY_DSN is unset', async () => {
      // The open-source default. A fork with no DSN must pay nothing at cold start.
      await loadHandler(undefined);

      expect(sentryMock.init).not.toHaveBeenCalled();
    });

    it('does not initialize Sentry when SENTRY_DSN is empty', async () => {
      // What a default `sam deploy` actually produces: the SentryDsn parameter defaults
      // to '' and reaches the Lambda as an empty string, not an absent variable. A
      // presence check (`!== undefined`) would pass the test above and still fail here.
      await loadHandler('');

      expect(sentryMock.init).not.toHaveBeenCalled();
    });

    it('initializes Sentry when SENTRY_DSN is set', async () => {
      await loadHandler('https://abc123@o1.ingest.sentry.io/456');

      expect(sentryMock.init).toHaveBeenCalledTimes(1);
      expect(sentryMock.init).toHaveBeenCalledWith(
        expect.objectContaining({ dsn: 'https://abc123@o1.ingest.sentry.io/456' })
      );
    });

    it('serves requests normally with no DSN configured', async () => {
      const handler = await loadHandler(undefined);

      const result = await handler(createEvent({
        requestContext: { http: { method: 'GET', path: '/mcp' } },
      }));

      expect(result.statusCode).toBe(405);
      expect(sentryMock.captureException).not.toHaveBeenCalled();
    });
  });

  describe('error reporting', () => {
    it('reports an unhandled handler crash to Sentry and rethrows it', async () => {
      const boom = new Error('transport exploded');
      vi.doMock('../../server.js', () => ({
        createServer: () => {
          throw boom;
        },
      }));

      const handler = await loadHandler('https://abc123@o1.ingest.sentry.io/456');

      await expect(handler(createEvent())).rejects.toThrow('transport exploded');
      expect(sentryMock.captureException).toHaveBeenCalledWith(boom);

      vi.doUnmock('../../server.js');
    });

    it('flushes the event before returning, so Lambda freezing cannot drop it', async () => {
      const order: string[] = [];
      sentryMock.captureException.mockImplementation(() => {
        order.push('capture');
      });
      sentryMock.flush.mockImplementation(async () => {
        order.push('flush');
        return true;
      });

      vi.doMock('../../server.js', () => ({
        createServer: () => {
          throw new Error('boom');
        },
      }));

      const handler = await loadHandler('https://abc123@o1.ingest.sentry.io/456');

      await expect(handler(createEvent())).rejects.toThrow('boom');
      expect(order).toEqual(['capture', 'flush']);
      expect(sentryMock.flush).toHaveBeenCalledWith(expect.any(Number));

      vi.doUnmock('../../server.js');
    });

    it('does not report ordinary rejected requests as errors', async () => {
      // A 401 is the endpoint working correctly, not an incident. Reporting these
      // would bury real crashes under routine traffic.
      const handler = await loadHandler('https://abc123@o1.ingest.sentry.io/456');

      const result = await handler(createEvent({ headers: { 'content-type': 'application/json' } }));

      expect(result.statusCode).toBe(401);
      expect(sentryMock.captureException).not.toHaveBeenCalled();
    });
  });
});
