#!/usr/bin/env node
// Serves the hosted MCP handler (src/lambda.ts, built to dist/lambda.mjs) over plain HTTP, so a
// coding agent can use it against a local BetaHub the way it uses https://mcp.betahub.io/:
//
//   BETAHUB_API_BASE=http://localhost:3148/ npm run dev:http
//
// PORT picks the port (default 3500). Every request is handed to the Lambda handler as an
// API Gateway event, exactly as in production.
import http from 'node:http';

const DEFAULT_PORT = 3500;
// Local only: the handler acts with whatever bearer token a caller sends.
const HOST = '127.0.0.1';
const port = Number(process.env.PORT || DEFAULT_PORT);
const { handler } = await import('../dist/lambda.mjs');

function eventFrom(req, body) {
  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([name, value]) => [name, Array.isArray(value) ? value.join(',') : value])
  );
  return {
    version: '2.0',
    headers,
    requestContext: { http: { method: req.method, path: req.url } },
    body: body.length > 0 ? body.toString('utf-8') : undefined,
    isBase64Encoded: false,
  };
}

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  try {
    const result = await handler(eventFrom(req, Buffer.concat(chunks)));
    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
  } catch (error) {
    console.error(error);
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('The MCP handler failed; see the terminal.');
  }
});

server.listen(port, HOST, () => {
  console.log(`BetaHub MCP on http://localhost:${port}/, using ${process.env.BETAHUB_API_BASE || 'https://app.betahub.io/'}`);
});
