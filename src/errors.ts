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
  constructor(message: string, public statusCode: number, public endpoint?: string) {
    super(message, statusCode);
    this.name = 'ApiError';
  }
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
  constructor(resource: string, id?: string) {
    const message = id ? `Access denied to ${resource} ${id}` : `Access denied to ${resource}`;
    super(message, 403);
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