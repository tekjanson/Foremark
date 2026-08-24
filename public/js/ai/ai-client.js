// public/js/ai/ai-client.js
// Client-side AI dispatcher & model switcher. Talks to the server proxy,
// injecting the user's chosen provider/model/keys from local settings.

import { api } from '../storage/api-client.js';
import { localStore } from '../storage/local-store.js';
import {
  SYSTEM_PROMPTS,
  buildFieldPrompt,
  buildSummaryPrompt,
} from './prompts.js';

export const PROVIDER_MODELS = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  gemini: ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-pro-latest'],
  ollama: ['llama3.1', 'mistral', 'qwen2.5'],
};

/** Merge the request with the user's saved AI settings. */
function withSettings(payload = {}) {
  const s = localStore.getSettings().ai || {};
  const provider = payload.provider || s.provider || undefined;
  const model = payload.model || (provider ? s.models?.[provider] : undefined);
  const apiKey = payload.apiKey || (provider ? s.keys?.[provider] : undefined);
  const baseUrl = payload.baseUrl || s.ollamaBaseUrl || undefined;
  return { ...payload, provider, model, apiKey, baseUrl };
}

export const aiClient = {
  /** Generic generation. */
  async generate({ system, prompt, provider, model } = {}) {
    const res = await api.aiGenerate(
      withSettings({ system, prompt, provider, model })
    );
    return res.text;
  },

  /** Fill a single field for a record. */
  async fillField(field, record, schema) {
    const prompt = buildFieldPrompt(field, record, schema);
    const res = await api.aiGenerate(
      withSettings({ system: SYSTEM_PROMPTS.fieldFill, prompt })
    );
    return res.text;
  },

  /** Summarize a whole record. */
  async summarizeRecord(record, schema) {
    const prompt = buildSummaryPrompt(record, schema);
    const res = await api.aiGenerate(
      withSettings({ system: SYSTEM_PROMPTS.summarize, prompt })
    );
    return res.text;
  },

  /** Extract structured records from unstructured text. */
  async extract(text, schema) {
    const res = await api.aiExtract(
      withSettings({ text, schema: { fields: schema.fields } })
    );
    return res.data;
  },

  getSettings() {
    return localStore.getSettings().ai || {};
  },

  saveSettings(ai) {
    const merged = { ...(localStore.getSettings().ai || {}), ...ai };
    localStore.updateSettings({ ai: merged });
    return merged;
  },
};
