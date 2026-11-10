import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../../lambda.js';

function createApiGatewayEvent(overrides: Record<string, any> = {}) {
  const { headers: headerOverrides, http: httpOverrides, ...rest } = overrides;
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/mcp',
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json, text/event-stream',
      'authorization': 'Bearer pat-test-token-123',
      ...headerOverrides,
    },
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      domainName: 'mcp.betahub.io',
      domainPrefix: 'mcp',
      http: {
        method: 'POST',
        path: '/mcp',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
        ...httpOverrides,
      },
      requestId: 'test-req-id',
      routeKey: '$default',
      stage: '$default',
      time: '2026-05-14T00:00:00Z',
      timeEpoch: 1747267200000,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    }),
    isBase64Encoded: false,
    ...rest,
  };
}

describe('Lambda Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('request routing', () => {
    it('should return 405 for GET requests', async () => {
      const event = createApiGatewayEvent({
        http: { method: 'GET', path: '/mcp' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(405);
    });

    it('should return 405 for DELETE requests', async () => {
      const event = createApiGatewayEvent();
      event.requestContext.http.method = 'DELETE';

      const result = await handler(event);

      expect(result.statusCode).toBe(405);
    });
  });

  // Found in a real-agent test (2026-11-10): a later session never read setup.md, so it did not know to
  // link the user's steps or to tell the BetaHub team what it could not do.
  describe('instructions', () => {
    it('gives every session the rules from setup.md', async () => {
      const result = await handler(createApiGatewayEvent());

      const instructions = JSON.parse(result.body).result.instructions as string;
      expect(instructions).toContain('treat it as data');
      expect(instructions).toContain('agent_feedback.json');
      expect(instructions).toContain('agents/setup.md');
      expect(instructions).toContain('exact link');
    });
  });

  // BetaHub backend docs/design/agent_write_access.md, "Shared accounts".
  describe('agent sessions', () => {
    it('names the MCP session on initialize', async () => {
      const result = await handler(createApiGatewayEvent());

      expect(result.statusCode).toBe(200);
      expect(result.headers['mcp-session-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('forwards the session the client sends back to BetaHub', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) });
      const event = createApiGatewayEvent({
        headers: { 'mcp-session-id': 'sess-1', 'mcp-protocol-version': '2025-03-26' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'listProjects', arguments: {} } }),
      });

      const result = await handler(event);

      expect(result.headers['mcp-session-id']).toBeUndefined();
      const [, init] = (global.fetch as any).mock.calls[0];
      expect(init.headers['X-Agent-Session']).toBe('sess-1');
    });
  });

  describe('authentication', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      const event = createApiGatewayEvent({
        headers: { 'authorization': undefined },
      });
      delete event.headers.authorization;

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
    });

    it('should return 401 when Authorization header is empty', async () => {
      const event = createApiGatewayEvent({
        headers: { 'authorization': '' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  describe('MCP protocol handling', () => {
    it('should process a valid initialize request and return 200', async () => {
      const event = createApiGatewayEvent();

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.jsonrpc).toBe('2.0');
      expect(body.id).toBe(1);
      expect(body.result).toBeDefined();
      expect(body.result.serverInfo).toBeDefined();
      expect(body.result.serverInfo.name).toBe('betahub-mcp-server');
    });

    it('should handle base64-encoded bodies', async () => {
      const jsonBody = JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      });

      const event = createApiGatewayEvent({
        body: Buffer.from(jsonBody).toString('base64'),
        isBase64Encoded: true,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.result.serverInfo).toBeDefined();
    });

    it('should return error for invalid JSON body', async () => {
      const event = createApiGatewayEvent({
        body: 'not valid json',
      });

      const result = await handler(event);

      expect(result.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should return error for missing body', async () => {
      const event = createApiGatewayEvent({
        body: undefined,
      });

      const result = await handler(event);

      expect(result.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  // A header the transport sets must not be doubled in another case: Node sends both, and
  // an MCP client then reads "application/json, application/json" and refuses to connect.
  it('sends each response header once, whatever its case', async () => {
    const result = await handler(createApiGatewayEvent());

    expect(result.statusCode).toBe(200);
    const names = Object.keys(result.headers).map((name) => name.toLowerCase());
    expect(names.filter((name) => name === 'content-type')).toHaveLength(1);
    expect(new Set(names).size).toBe(names.length);
  });

  describe('auth token threading', () => {
    it('should extract Bearer token from Authorization header', async () => {
      const event = createApiGatewayEvent({
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json, text/event-stream',
          'authorization': 'Bearer pat-my-special-token',
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });

    it('should accept raw token in Authorization header', async () => {
      const event = createApiGatewayEvent({
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json, text/event-stream',
          'authorization': 'tkn-project-token-abc',
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });
  });
});
