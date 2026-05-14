import { describe, it, expect } from 'vitest';
import { formatIssues, ISSUE_FIELDS, DEFAULT_MAX_FIELD_LENGTH } from '../../../tools/issueFormatter.js';
import { createIssue } from '../../helpers/factories.js';

describe('issueFormatter', () => {
  describe('ISSUE_FIELDS', () => {
    it('should contain all valid issue field names', () => {
      expect(ISSUE_FIELDS).toContain('id');
      expect(ISSUE_FIELDS).toContain('title');
      expect(ISSUE_FIELDS).toContain('description');
      expect(ISSUE_FIELDS).toContain('status');
      expect(ISSUE_FIELDS).toContain('priority');
      expect(ISSUE_FIELDS).toContain('score');
      expect(ISSUE_FIELDS).toContain('steps_to_reproduce');
      expect(ISSUE_FIELDS).toContain('assigned_to');
      expect(ISSUE_FIELDS).toContain('reported_by');
      expect(ISSUE_FIELDS).toContain('potential_duplicate');
      expect(ISSUE_FIELDS).toContain('created_at');
      expect(ISSUE_FIELDS).toContain('updated_at');
      expect(ISSUE_FIELDS).toContain('url');
    });

    it('should not contain token field', () => {
      expect(ISSUE_FIELDS).not.toContain('token');
    });
  });

  describe('DEFAULT_MAX_FIELD_LENGTH', () => {
    it('should be 300', () => {
      expect(DEFAULT_MAX_FIELD_LENGTH).toBe(300);
    });
  });

  describe('formatIssues', () => {
    it('should truncate description to default maxFieldLength with ellipsis', () => {
      const longDescription = 'A'.repeat(500);
      const issues = [createIssue({ description: longDescription })];

      const result = formatIssues(issues);

      expect(result[0].description).toHaveLength(303); // 300 + "..."
      expect(result[0].description).toBe('A'.repeat(300) + '...');
    });

    it('should not truncate description shorter than maxFieldLength', () => {
      const shortDescription = 'Short bug description';
      const issues = [createIssue({ description: shortDescription })];

      const result = formatIssues(issues);

      expect(result[0].description).toBe(shortDescription);
    });

    it('should truncate each individual step in steps_to_reproduce', () => {
      const longStep = 'B'.repeat(500);
      const issues = [createIssue({
        steps_to_reproduce: [
          { step: 'Short step' },
          { step: longStep },
          { step: 'Another short step' },
        ],
      })];

      const result = formatIssues(issues);

      expect(result[0].steps_to_reproduce).toHaveLength(3);
      expect(result[0].steps_to_reproduce[0].step).toBe('Short step');
      expect(result[0].steps_to_reproduce[1].step).toBe('B'.repeat(300) + '...');
      expect(result[0].steps_to_reproduce[2].step).toBe('Another short step');
    });

    it('should truncate stringified potential_duplicate when it exceeds maxFieldLength', () => {
      const bigDuplicate = { id: 'dup-1', title: 'Dup', description: 'C'.repeat(500) };
      const issues = [createIssue({ potential_duplicate: bigDuplicate })];

      const result = formatIssues(issues);

      expect(typeof result[0].potential_duplicate).toBe('string');
      expect((result[0].potential_duplicate as string).length).toBeLessThanOrEqual(303);
      expect((result[0].potential_duplicate as string).endsWith('...')).toBe(true);
    });

    it('should preserve potential_duplicate as object when it fits within maxFieldLength', () => {
      const smallDuplicate = { id: 'dup-1', title: 'Small' };
      const issues = [createIssue({ potential_duplicate: smallDuplicate })];

      const result = formatIssues(issues);

      expect(typeof result[0].potential_duplicate).toBe('object');
      expect(result[0].potential_duplicate).toEqual(smallDuplicate);
    });

    it('should not truncate when maxFieldLength is 0', () => {
      const longDescription = 'D'.repeat(500);
      const issues = [createIssue({ description: longDescription })];

      const result = formatIssues(issues, { maxFieldLength: 0 });

      expect(result[0].description).toBe(longDescription);
    });

    it('should use custom maxFieldLength', () => {
      const longDescription = 'E'.repeat(200);
      const issues = [createIssue({ description: longDescription })];

      const result = formatIssues(issues, { maxFieldLength: 100 });

      expect(result[0].description).toHaveLength(103); // 100 + "..."
      expect(result[0].description).toBe('E'.repeat(100) + '...');
    });

    it('should filter to specified fields only', () => {
      const issues = [createIssue()];

      const result = formatIssues(issues, { fields: ['id', 'title', 'status'] });

      expect(Object.keys(result[0])).toEqual(['id', 'title', 'status']);
      expect(result[0].id).toBeDefined();
      expect(result[0].title).toBeDefined();
      expect(result[0].status).toBeDefined();
    });

    it('should return all standard fields when fields is not specified', () => {
      const issues = [createIssue()];

      const result = formatIssues(issues);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('status');
      expect(result[0]).toHaveProperty('priority');
      expect(result[0]).toHaveProperty('score');
      expect(result[0]).toHaveProperty('steps_to_reproduce');
      expect(result[0]).toHaveProperty('assigned_to');
      expect(result[0]).toHaveProperty('reported_by');
      expect(result[0]).toHaveProperty('potential_duplicate');
      expect(result[0]).toHaveProperty('created_at');
      expect(result[0]).toHaveProperty('updated_at');
      expect(result[0]).toHaveProperty('url');
      expect(result[0]).not.toHaveProperty('token');
    });

    it('should handle undefined steps_to_reproduce', () => {
      const issues = [createIssue({ steps_to_reproduce: undefined })];

      const result = formatIssues(issues);

      expect(result[0].steps_to_reproduce).toBeUndefined();
    });

    it('should handle null potential_duplicate', () => {
      const issues = [createIssue({ potential_duplicate: null })];

      const result = formatIssues(issues);

      expect(result[0].potential_duplicate).toBeNull();
    });

    it('should format multiple issues', () => {
      const issues = [
        createIssue({ id: 'i-1', description: 'F'.repeat(500) }),
        createIssue({ id: 'i-2', description: 'Short' }),
        createIssue({ id: 'i-3', description: 'G'.repeat(400) }),
      ];

      const result = formatIssues(issues);

      expect(result).toHaveLength(3);
      expect(result[0].description).toBe('F'.repeat(300) + '...');
      expect(result[1].description).toBe('Short');
      expect(result[2].description).toBe('G'.repeat(300) + '...');
    });

    it('should apply truncation to selected fields', () => {
      const issues = [createIssue({ description: 'H'.repeat(500) })];

      const result = formatIssues(issues, { fields: ['id', 'description'], maxFieldLength: 50 });

      expect(Object.keys(result[0])).toEqual(['id', 'description']);
      expect(result[0].description).toBe('H'.repeat(50) + '...');
    });
  });
});
