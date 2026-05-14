import { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';

export interface ApiGatewayEvent {
  version: string;
  headers: Record<string, string | undefined>;
  requestContext: {
    http: {
      method: string;
      path: string;
    };
  };
  body?: string;
  isBase64Encoded: boolean;
}

export interface ApiGatewayResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function extractToken(headers: Record<string, string | undefined>): string | undefined {
  const auth = headers['authorization'] || headers['Authorization'];
  if (!auth) return undefined;

  if (auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return auth;
}

function createMockRequest(
  method: string,
  headers: Record<string, string | undefined>,
  token?: string,
): IncomingMessage & { auth?: { token: string; clientId: string; scopes: string[] } } {
  const req = {
    method,
    headers: headers as Record<string, string>,
  } as IncomingMessage & { auth?: { token: string; clientId: string; scopes: string[] } };

  if (token) {
    req.auth = { token, clientId: '', scopes: [] };
  }

  return req;
}

function createMockResponse(): {
  res: ServerResponse;
  getResult: () => Promise<{ statusCode: number; headers: Record<string, string>; body: string }>;
} {
  let statusCode = 200;
  let responseHeaders: Record<string, string> = {};
  let body = '';
  let resolvePromise: (value: { statusCode: number; headers: Record<string, string>; body: string }) => void;

  const resultPromise = new Promise<{ statusCode: number; headers: Record<string, string>; body: string }>(
    (resolve) => { resolvePromise = resolve; }
  );

  const closeHandlers: Array<() => void> = [];

  const res = {
    writeHead(status: number, headers?: Record<string, string>) {
      statusCode = status;
      if (headers) {
        responseHeaders = { ...responseHeaders, ...headers };
      }
      return res;
    },
    end(data?: string) {
      if (data) body += data;
      resolvePromise!({ statusCode, headers: responseHeaders, body });
      for (const handler of closeHandlers) handler();
      return res;
    },
    write(data: string) {
      body += data;
      return true;
    },
    on(event: string, callback: () => void) {
      if (event === 'close') closeHandlers.push(callback);
      return res;
    },
    flushHeaders() {},
  } as unknown as ServerResponse;

  return { res, getResult: () => resultPromise };
}

export async function handler(event: ApiGatewayEvent): Promise<ApiGatewayResult> {
  const method = event.requestContext.http.method;

  if (method !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed' },
        id: null,
      }),
    };
  }

  const token = extractToken(event.headers);
  if (!token) {
    return {
      statusCode: 401,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Authorization header required' },
        id: null,
      }),
    };
  }

  let parsedBody: unknown;
  try {
    const rawBody = event.isBase64Encoded && event.body
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;

    if (!rawBody) {
      return {
        statusCode: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error: empty body' },
          id: null,
        }),
      };
    }

    parsedBody = JSON.parse(rawBody);
  } catch {
    return {
      statusCode: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error: invalid JSON' },
        id: null,
      }),
    };
  }

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);

    const req = createMockRequest(method, event.headers, token);
    const { res, getResult } = createMockResponse();

    await transport.handleRequest(req, res, parsedBody);

    const result = await getResult();

    return {
      statusCode: result.statusCode,
      headers: { 'content-type': 'application/json', ...result.headers },
      body: result.body,
    };
  } finally {
    await transport.close();
    await server.close();
  }
}
