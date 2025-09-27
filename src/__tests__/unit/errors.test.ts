/**
 * Unit tests for error handling module
 */

import { describe, it, expect } from 'vitest';
import {
  BetaHubError,
  AuthenticationError,
  ApiError,
  ValidationError,
  NotFoundError,
  AccessDeniedError,
  isHttpError,
  formatErrorMessage,
} from '../../errors.js';

describe('Error Classes', () => {
  describe('BetaHubError', () => {
    it('should create error with message and status code', () => {
      const error = new BetaHubError('Test error', 500);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('BetaHubError');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('AuthenticationError', () => {
    it('should default to 401 status code', () => {
      const error = new AuthenticationError('Invalid token');
      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthenticationError');
    });

    it('should allow custom status code', () => {
      const error = new AuthenticationError('Token expired', 403);
      expect(error.statusCode).toBe(403);
    });

    it('should inherit from BetaHubError', () => {
      const error = new AuthenticationError('Test');
      expect(error instanceof BetaHubError).toBe(true);
    });
  });

  describe('ApiError', () => {
    it('should include endpoint information', () => {
      const error = new ApiError('Request failed', 500, '/api/projects');
      expect(error.message).toBe('Request failed');
      expect(error.statusCode).toBe(500);
      expect(error.endpoint).toBe('/api/projects');
      expect(error.name).toBe('ApiError');
    });

    it('should work without endpoint', () => {
      const error = new ApiError('Request failed', 500);
      expect(error.endpoint).toBeUndefined();
    });
  });

  describe('ValidationError', () => {
    it('should default to 400 status code', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
    });

    it('should include field information', () => {
      const error = new ValidationError('Required field', 'projectId');
      expect(error.field).toBe('projectId');
    });
  });

  describe('NotFoundError', () => {
    it('should format message with resource and id', () => {
      const error = new NotFoundError('Project', 'pr-123');
      expect(error.message).toBe('Project pr-123 not found');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
    });

    it('should format message with just resource', () => {
      const error = new NotFoundError('Projects');
      expect(error.message).toBe('Projects not found');
    });
  });

  describe('AccessDeniedError', () => {
    it('should format message with resource and id', () => {
      const error = new AccessDeniedError('project', 'pr-123');
      expect(error.message).toBe('Access denied to project pr-123');
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('AccessDeniedError');
    });

    it('should format message with just resource', () => {
      const error = new AccessDeniedError('admin panel');
      expect(error.message).toBe('Access denied to admin panel');
    });
  });
});

describe('Helper Functions', () => {
  describe('isHttpError', () => {
    it('should identify objects with status property', () => {
      expect(isHttpError({ status: 404 })).toBe(true);
      expect(isHttpError({ statusCode: 500 })).toBe(true);
      expect(isHttpError({ status: 200, statusCode: 200 })).toBe(true);
    });

    it('should return false for non-HTTP errors', () => {
      expect(isHttpError(null)).toBe(false);
      expect(isHttpError(undefined)).toBe(false);
      expect(isHttpError('error')).toBe(false);
      expect(isHttpError({})).toBe(false);
      expect(isHttpError({ message: 'error' })).toBe(false);
    });
  });

  describe('formatErrorMessage', () => {
    it('should format BetaHubError messages', () => {
      const error = new BetaHubError('Custom error');
      expect(formatErrorMessage(error)).toBe('Custom error');
    });

    it('should format standard Error messages', () => {
      const error = new Error('Standard error');
      expect(formatErrorMessage(error)).toBe('Standard error');
    });

    it('should convert non-Error values to strings', () => {
      expect(formatErrorMessage('String error')).toBe('String error');
      expect(formatErrorMessage(404)).toBe('404');
      expect(formatErrorMessage(null)).toBe('null');
      expect(formatErrorMessage(undefined)).toBe('undefined');
    });
  });
});