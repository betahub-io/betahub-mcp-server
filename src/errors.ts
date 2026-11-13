/**
 * Custom error classes for BetaHub MCP Server
 */

export class BetaHubError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'BetaHubError';
  }
}

export class AuthenticationError extends BetaHubError {
  constructor(message: string, statusCode = 401) {
    super(message, statusCode);
    this.name = 'AuthenticationError';
  }
}

export class ApiError extends BetaHubError {
  // serverMessage: the `error` field of a JSON error body, when the backend explains itself
  // (e.g. which plan feature is missing), as opposed to the bare HTTP status text in `message`.
  // hint: what the backend tells a coding agent to do next (see api/agentHint.ts); the message
  // carries it, so every tool that reports `error.message` passes it on.
  constructor(message: string, public statusCode: number, public endpoint?: string, public serverMessage?: string,
              public hint?: string) {
    super(hint ? joinSentences(message, hint) : message, statusCode);
    this.name = 'ApiError';
  }
}

// "Access denied." + "Missing access: x." without a doubled full stop.
function joinSentences(first: string, second: string): string {
  return /[.!?]$/.test(first) ? `${first} ${second}` : `${first}. ${second}`;
}

export class ValidationError extends BetaHubError {
  constructor(message: string, public field?: string) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} ${id} not found` : `${resource} not found`;
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class AccessDeniedError extends ApiError {
  constructor(resource: string, id?: string, hint?: string) {
    const message = id ? `Access denied to ${resource} ${id}` : `Access denied to ${resource}`;
    super(message, 403, undefined, undefined, hint);
    this.name = 'AccessDeniedError';
  }
}

export function isHttpError(error: unknown): error is { status?: number; statusCode?: number } {
  return error !== null && typeof error === 'object' &&
         ('status' in error || 'statusCode' in error);
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof BetaHubError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}