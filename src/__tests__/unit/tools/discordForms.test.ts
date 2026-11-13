/**
 * Unit tests for the Discord form tools (BetaHub backend docs/design/agent_write_access.md, W18)
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createDiscordForm,
  createDiscordFormDefinition,
  listDiscordForms,
  listDiscordFormsDefinition,
  updateDiscordForm,
  updateDiscordFormDefinition,
} from '../../../tools/discordForms.js';
import { ApiError, ValidationError } from '../../../errors.js';
import { API_BASE, clientAnswering, missingScopeBody, parseResult } from '../../helpers/wire.js';

const description = { key: 'details', type: 'long' as const, title: 'What happened?', isDescription: true };
const platform = {
  key: 'platform', type: 'single' as const, title: 'Which platform?',
  options: [{ value: 'pc', label: 'PC' }, { value: 'console', label: 'Console' }],
};

function formJson(overrides: Record<string, unknown> = {}) {
  return {
    id: 7, slug: 'crash-report', kind: 'bug', name: 'Crash report', enabled: false,
    intro_message: null, dedup_enabled: false,
    url: 'https://app.betahub.io/projects/pr-1/discord/forms/7/edit', default_form_setting: 'default_bug_form',
    field_config: { steps: [
      { key: 'platform', type: 'single', title: 'Which platform?', custom_field_id: 3, custom_field_ident: 'platform',
        options: [{ value: 'pc', label: 'PC' }, { value: 'console', label: 'Console' }] },
      { key: 'details', type: 'long', title: 'What happened?', is_description: true },
    ] },
    ...overrides,
  };
}

describe('Discord form tools', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('definitions', () => {
    it('list reads; create and update change reversibly, and say how players get a form', () => {
      expect(listDiscordFormsDefinition.annotations.readOnlyHint).toBe(true);
      expect(createDiscordFormDefinition.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
      expect(updateDiscordFormDefinition.annotations).toMatchObject({ readOnlyHint: false, idempotentHint: true });
      for (const definition of [createDiscordFormDefinition, updateDiscordFormDefinition]) {
        expect(definition.description).toContain('activity feed');
        expect(definition.description).toContain('cannot be deleted');
      }
      expect(createDiscordFormDefinition.description).toContain('`/set`');
      expect(updateDiscordFormDefinition.description).toContain('confirm with the user');
    });
  });

  it('lists forms with the command that sets each in Discord', async () => {
    const { client, sent } = clientAnswering(200, { forms: [formJson()] });

    const result = parseResult(await listDiscordForms({ projectId: 'pr-1' }, client));

    expect(sent()).toEqual({ url: `${API_BASE}projects/pr-1/discord/forms.json`, method: 'GET', body: undefined });
    expect(result.forms[0]).toMatchObject({
      id: 7, enabled: false, builder_url: 'https://app.betahub.io/projects/pr-1/discord/forms/7/edit',
      discord_command: '/set default_bug_form crash-report',
    });
    // In the tools' own words, so a listed form's steps can be edited and sent back.
    expect(result.forms[0].steps).toEqual([
      { key: 'platform', type: 'single', title: 'Which platform?', customFieldIdent: 'platform',
        options: [{ value: 'pc', label: 'PC' }, { value: 'console', label: 'Console' }] },
      { key: 'details', type: 'long', title: 'What happened?', isDescription: true },
    ]);
  });

  it('says which options a select field did not keep', async () => {
    const saved = formJson({ field_config: { steps: [
      { key: 'platform', type: 'single', title: 'Which platform?', custom_field_id: 3, custom_field_ident: 'platform',
        options: [{ value: 'pc', label: 'PC' }] },
      { key: 'details', type: 'long', title: 'What happened?', is_description: true },
    ] } });
    const { client } = clientAnswering(200, saved);

    const result = parseResult(await createDiscordForm({
      projectId: 'pr-1', kind: 'bug', name: 'Crash report',
      steps: [{ ...platform, customFieldIdent: 'platform' }, description],
    }, client));

    expect(result.warnings).toEqual([expect.stringContaining('lost the options "console"')]);
  });

  it('creates a form, steps in the backend\'s words', async () => {
    const { client, sent } = clientAnswering(200, formJson());

    const result = parseResult(await createDiscordForm({
      projectId: 'pr-1', kind: 'bug', name: 'Crash report',
      steps: [{ ...platform, customFieldIdent: 'platform' }, description],
    }, client));

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/discord/forms.json`,
      method: 'POST',
      body: { discord_form: { kind: 'bug', name: 'Crash report', field_config: { steps: [
        { ...platform, custom_field_ident: 'platform' },
        { key: 'details', type: 'long', title: 'What happened?', is_description: true },
      ] } } },
    });
    expect(result.form.id).toBe(7);
    expect(result).not.toHaveProperty('warnings');
  });

  it('says when BetaHub did not keep a custom field a step asked for', async () => {
    const saved = formJson({ field_config: { steps: [{ key: 'platform', type: 'single', title: 'Which platform?' },
      { key: 'details', type: 'long', title: 'What happened?', is_description: true }] } });
    const { client } = clientAnswering(200, saved);

    const result = parseResult(await createDiscordForm({
      projectId: 'pr-1', kind: 'bug', name: 'Crash report',
      steps: [{ ...platform, customFieldIdent: 'platform' }, description],
    }, client));

    expect(result.warnings).toEqual([expect.stringContaining('Step "platform" does not save its answer in "platform"')]);
  });

  // Found in a workspace test (2026-11-13): a created field takes the labels as its values.
  it('does not warn when a step creates its field and the options take their labels as values', async () => {
    const saved = formJson({ field_config: { steps: [
      { key: 'platform', type: 'single', title: 'Which platform?', custom_field_id: 9, custom_field_ident: 'which_platform',
        options: [{ value: 'PC', label: 'PC' }, { value: 'Console', label: 'Console' }] },
      { key: 'details', type: 'long', title: 'What happened?', is_description: true },
    ] } });
    const { client } = clientAnswering(200, saved);

    const result = parseResult(await createDiscordForm({
      projectId: 'pr-1', kind: 'bug', name: 'Crash report', steps: [{ ...platform, createCustomField: true }, description],
    }, client));

    expect(result).not.toHaveProperty('warnings');
  });

  it('passes BetaHub\'s reason on when a form cannot be saved', async () => {
    const { client } = clientAnswering(422, { error: 'The form must end with a description step.', errors: ['x'] });

    await expect(createDiscordForm({ projectId: 'pr-1', kind: 'bug', name: 'Crash report', steps: [platform] }, client))
      .rejects.toThrow('Failed to create the Discord form "Crash report": The form must end with a description step.');
  });

  it('switches a form off, sending only that', async () => {
    const { client, sent } = clientAnswering(200, formJson({ enabled: false }));

    await updateDiscordForm({ projectId: 'pr-1', formId: 7, enabled: false }, client);

    expect(sent()).toEqual({
      url: `${API_BASE}projects/pr-1/discord/forms/7.json`, method: 'PATCH', body: { discord_form: { enabled: false } },
    });
  });

  it('refuses an update that changes nothing, before calling BetaHub', async () => {
    const { client, fetchMock } = clientAnswering(200, formJson());

    await expect(updateDiscordForm({ projectId: 'pr-1', formId: 7 }, client)).rejects.toThrow(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('relays how to ask for "Read and work"', async () => {
    const { client } = clientAnswering(403, missingScopeBody('project.settings.edit'));

    const error = await updateDiscordForm({ projectId: 'pr-1', formId: 7, name: 'x' }, client).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toContain('access denied');
    expect(error.message).toContain('"intent": "work"');
  });

  it('gives the link to switch Forms & Surveys on', async () => {
    const { client } = clientAnswering(422, {
      error: 'module_disabled', module: 'surveys', url: 'https://app.betahub.io/projects/pr-1/edit',
      message: 'Discord forms are part of Forms & Surveys, which is off in this project.',
    });

    await expect(listDiscordForms({ projectId: 'pr-1' }, client))
      .rejects.toThrow('Link for the user: https://app.betahub.io/projects/pr-1/edit');
  });
});
