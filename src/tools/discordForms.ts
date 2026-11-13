/**
 * Discord form tools (BetaHub backend docs/design/agent_write_access.md, W18).
 * List, build, change and switch the step-by-step forms the BetaHub Discord bot shows players.
 * The backend enforces access, the hourly cap and that forms are never deleted; these tools
 * describe the rules and report what BetaHub did not keep.
 */

import { z } from 'zod';
import { getApiClient, type BetaHubApiClient } from '../api/client.js';
import type { DiscordForm, DiscordFormsResponse, DiscordFormStep } from '../types/betahub.js';
import type { ToolResponse } from '../types/mcp.js';
import { jsonResponse } from './communityShared.js';
import { FEED, WRITE_ANNOTATIONS, discordFormsPath, parseInput, projectIdField, toWriteError } from './writeShared.js';

export const DISCORD_FORM_KINDS = ['bug', 'suggestion', 'ticket'] as const;
export const DISCORD_FORM_STEP_TYPES = ['single', 'multi', 'short', 'long'] as const;
// Discord shows at most this many choices in one step.
const MAX_OPTIONS = 25;
// Discord's cap on a text answer, so also the highest minimum a step can ask for.
const MAX_TEXT_LENGTH = 4000;

const HOW_PLAYERS_SEE_IT =
  'Players see a form only while it is switched on and after a Discord server admin runs the `/set` command ' +
  'the form lists (discord_command).';
const NO_DELETING = 'Forms cannot be deleted through these tools: switch one off instead.';

const optionSchema = z.object({
  value: z.string().min(1).describe('Stored answer; with customFieldIdent, one of the field\'s values'),
  label: z.string().min(1).describe('What the player sees'),
  emoji: z.string().optional(),
  description: z.string().optional(),
});

const stepSchema = z.object({
  key: z.string().min(1).describe('Unique within the form; visibleIf refers to steps by it'),
  type: z.enum(DISCORD_FORM_STEP_TYPES).describe('single: one choice; multi: several; short / long: a text answer'),
  title: z.string().min(1).describe('The question'),
  help: z.string().optional(),
  required: z.boolean().optional().describe('The player must answer it (optional steps get a Skip button); false by default'),
  options: z.array(optionSchema).max(MAX_OPTIONS).optional().describe(`single and multi steps; at most ${MAX_OPTIONS}`),
  display: z.enum(['buttons', 'dropdown']).optional().describe('How a choice step shows on Discord (buttons by default)'),
  customFieldIdent: z
    .string()
    .optional()
    .describe(
      'Save the answer in this custom field (ident from listCustomFields): a field players may set, for the form\'s ' +
      'kind, of a matching type (single_select for single, multi_select for multi, text for short or long). A select ' +
      'step keeps only the options that use the field\'s values.'
    ),
  createCustomField: z
    .boolean()
    .optional()
    .describe('On a single step with options and no customFieldIdent: create a single_select custom field named after the title'),
  isDescription: z
    .boolean()
    .optional()
    .describe('Exactly one step, the last, a short or long text step: its answer becomes the report\'s description'),
  withReproductionSteps: z.boolean().optional().describe('Bug forms: adds a box for steps to reproduce to the description step'),
  minLength: z.number().int().min(0).max(MAX_TEXT_LENGTH).optional().describe('The description step\'s minimum length'),
  visibleIf: z
    .object({ step: z.string().min(1), in: z.array(z.string().min(1)).min(1) })
    .optional()
    .describe('Show the step only when an earlier choice step was answered with one of these values'),
});

type StepInput = z.infer<typeof stepSchema>;

const formIdField = z.number().int().positive().describe('The form\'s id, from listDiscordForms');

// --- listDiscordForms -----------------------------------------------------------------------

export const listDiscordFormsInputSchema = { projectId: projectIdField };

export const listDiscordFormsDefinition = {
  title: 'List Discord Forms',
  description:
    'List a project\'s Discord forms: the step-by-step wizards the BetaHub Discord bot shows when a player reports a ' +
    `bug, suggests something or opens a ticket, switched-off forms included, with their steps. ${HOW_PLAYERS_SEE_IT} ` +
    'Discord forms are part of the project\'s Forms & Surveys module.',
  inputSchema: listDiscordFormsInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
};

export async function listDiscordForms(
  { projectId }: { projectId: string },
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  let response: DiscordFormsResponse;
  try {
    response = await (apiClient || getApiClient()).get<DiscordFormsResponse>(discordFormsPath(projectId));
  } catch (error) {
    throw toWriteError(error, `list the Discord forms of project ${projectId}`, `Project ${projectId} not found`);
  }
  return jsonResponse({ project_id: projectId, forms: response.forms.map(formatForm) });
}

// --- createDiscordForm ----------------------------------------------------------------------

export const createDiscordFormInputSchema = {
  projectId: projectIdField,
  kind: z.enum(DISCORD_FORM_KINDS).describe('What a submission creates; it cannot change later'),
  name: z.string().min(1),
  steps: z.array(stepSchema).min(1).describe('In order; the last one is the description step'),
  introMessage: z.string().optional().describe('Shown to the player before the first step'),
  enabled: z.boolean().optional().describe('Switch it on at once (off by default)'),
  dedupEnabled: z.boolean().optional().describe('Check for duplicates before the report is sent'),
};

export const createDiscordFormDefinition = {
  title: 'Create Discord Form',
  description:
    'Build a new Discord form from its steps. Every form ends with one short or long text step marked isDescription, ' +
    'whose answer becomes the report\'s description. A step can save its answer in a custom field (customFieldIdent) ' +
    `or create one (createCustomField). New forms start switched off; confirm with the user before creating one switched ` +
    `on. ${HOW_PLAYERS_SEE_IT} Give the user builder_url to preview the form and the command to set it. ` +
    `${FEED} ${NO_DELETING}`,
  inputSchema: createDiscordFormInputSchema,
  annotations: WRITE_ANNOTATIONS,
};

export async function createDiscordForm(
  input: { projectId: string; kind: (typeof DISCORD_FORM_KINDS)[number]; name: string; steps: StepInput[];
    introMessage?: string; enabled?: boolean; dedupEnabled?: boolean },
  apiClient?: BetaHubApiClient
): Promise<ToolResponse> {
  const { projectId, kind, name, steps, introMessage, enabled, dedupEnabled } = input;
  const action = `create the Discord form "${name}"`;
  let form: DiscordForm;
  try {
    form = await (apiClient || getApiClient()).post<DiscordForm>(discordFormsPath(projectId), {
      discord_form: compact({
        kind, name, intro_message: introMessage, enabled, dedup_enabled: dedupEnabled,
        field_config: { steps: steps.map(toBackendStep) },
      }),
    });
  } catch (error) {
    throw toWriteError(error, action, `Project ${projectId} not found`);
  }
  return savedFormResponse(projectId, form, steps);
}

// --- updateDiscordForm ----------------------------------------------------------------------

export const updateDiscordFormInputSchema = {
  projectId: projectIdField,
  formId: formIdField,
  name: z.string().min(1).optional(),
  steps: z.array(stepSchema).min(1).optional().describe('The whole new list of steps; it replaces the old one'),
  introMessage: z.string().optional(),
  enabled: z.boolean().optional().describe('Switch the form on (true) or off (false)'),
  dedupEnabled: z.boolean().optional(),
};

const updateRules = z.object(updateDiscordFormInputSchema).refine(
  ({ name, steps, introMessage, enabled, dedupEnabled }) =>
    [name, steps, introMessage, enabled, dedupEnabled].some((value) => value !== undefined),
  { message: 'Send at least one change: name, steps, introMessage, enabled or dedupEnabled' }
);

export const updateDiscordFormDefinition = {
  title: 'Update Discord Form',
  description:
    'Change a Discord form: its name, intro, duplicate check or the whole list of steps (steps replaces all of them), ' +
    'or switch it on or off. A switched-on form may already be in front of players and a change shows to them at ' +
    'once: confirm with the user before changing a switched-on form or switching one on. The kind cannot change. ' +
    `The team's activity feed shows what changed, marked as made through this agent. ${NO_DELETING}`,
  inputSchema: updateDiscordFormInputSchema,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
};

export async function updateDiscordForm(input: unknown, apiClient?: BetaHubApiClient): Promise<ToolResponse> {
  const { projectId, formId, name, steps, introMessage, enabled, dedupEnabled } = parseInput(updateRules, input);
  const action = `change Discord form ${formId}`;
  let form: DiscordForm;
  try {
    form = await (apiClient || getApiClient()).patch<DiscordForm>(discordFormsPath(projectId, formId), {
      discord_form: compact({
        name, intro_message: introMessage, enabled, dedup_enabled: dedupEnabled,
        field_config: steps ? { steps: steps.map(toBackendStep) } : undefined,
      }),
    });
  } catch (error) {
    throw toWriteError(error, action, `Discord form ${formId} not found in project ${projectId}`);
  }
  return savedFormResponse(projectId, form, steps ?? []);
}

// --- Shared ---------------------------------------------------------------------------------

function toBackendStep(step: StepInput): Record<string, unknown> {
  return compact({
    key: step.key,
    type: step.type,
    title: step.title,
    help: step.help,
    required: step.required,
    options: step.options,
    display: step.display,
    custom_field_ident: step.customFieldIdent,
    create_custom_field: step.createCustomField,
    is_description: step.isDescription,
    with_reproduction_steps: step.withReproductionSteps,
    min_length: step.minLength,
    visible_if: step.visibleIf,
  });
}

// Steps come back in the shape the tools take, so an agent can edit a listed form and send its steps back.
function fromBackendStep(step: DiscordFormStep): Record<string, unknown> {
  return compact({
    key: step.key,
    type: step.type,
    title: step.title,
    help: step.help,
    required: step.required,
    options: step.options,
    display: step.display,
    customFieldIdent: step.custom_field_ident,
    isDescription: step.is_description,
    withReproductionSteps: step.with_reproduction_steps,
    minLength: step.min_length,
    visibleIf: step.visible_if,
  });
}

function compact(object: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function formatForm(form: DiscordForm) {
  return {
    id: form.id,
    slug: form.slug,
    kind: form.kind,
    name: form.name,
    enabled: form.enabled,
    intro_message: form.intro_message,
    dedup_enabled: form.dedup_enabled,
    builder_url: form.url,
    discord_command: `/set ${form.default_form_setting} ${form.slug}`,
    steps: (form.field_config?.steps ?? []).map(fromBackendStep),
  };
}

// BetaHub drops a custom field a step cannot use, without an error: say so, or the agent reports a mapping
// that is not there.
function droppedFields(sent: StepInput[], saved: DiscordFormStep[]): string[] {
  const savedByKey = new Map(saved.map((step) => [step.key, step]));
  return sent.flatMap((step) => {
    const kept = savedByKey.get(step.key);
    if (step.customFieldIdent && kept?.custom_field_ident !== step.customFieldIdent) {
      return [
        `Step "${step.key}" does not save its answer in "${step.customFieldIdent}": BetaHub keeps a custom field only ` +
        'if players may set it, it belongs to this form\'s kind, its type matches the step and, for a select field, ' +
        'the options use its values.',
      ];
    }
    if (step.createCustomField && !kept?.custom_field_id) {
      return [`Step "${step.key}" got no custom field: only a single step with options and no field can create one.`];
    }
    // A step saved to a select field keeps only the options that use the field's values.
    const keptValues = new Set(((kept?.options as Array<{ value: string }> | undefined) ?? []).map((o) => o.value));
    const droppedOptions = (step.options ?? []).filter((option) => !keptValues.has(option.value)).map((o) => o.value);
    if (kept && droppedOptions.length > 0) {
      return [
        `Step "${step.key}" lost the options ${droppedOptions.map((value) => `"${value}"`).join(', ')}: ` +
        'its custom field does not have those values, so players cannot pick them.',
      ];
    }
    return [];
  });
}

function savedFormResponse(projectId: string, form: DiscordForm, sent: StepInput[]): ToolResponse {
  const warnings = droppedFields(sent, form.field_config?.steps ?? []);
  return jsonResponse({ project_id: projectId, form: formatForm(form), ...(warnings.length > 0 ? { warnings } : {}) });
}
