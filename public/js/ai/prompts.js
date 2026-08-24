// public/js/ai/prompts.js
// System prompts and prompt builders for extraction, summarization, and fill.

export const SYSTEM_PROMPTS = {
  fieldFill:
    'You are an expert assistant helping a professional fill in a single ' +
    'form field. Respond with ONLY the value for the field — no preamble, ' +
    'quotes, labels, or markdown. Keep it concise and appropriate for the ' +
    'field type.',
  summarize:
    'You summarize content clearly and professionally. Return only the ' +
    'summary text.',
  extract:
    'You are a precise data-extraction engine. Convert unstructured input ' +
    'into structured JSON that matches the requested schema. Return ONLY ' +
    'valid JSON — no markdown fences or commentary.',
};

/**
 * Build a field-fill prompt from a field's aiPrompt template and record context.
 * Supports {{context}} and {{field.key}} substitutions.
 */
export function buildFieldPrompt(field, record, schema) {
  const context = buildRecordContext(record, schema);
  let template =
    field.aiPrompt ||
    `Generate an appropriate value for the "${field.label || field.key}" field based on: {{context}}`;

  template = template.replace(/\{\{context\}\}/g, context || '(no other data yet)');
  template = template.replace(/\{\{field\.([\w.-]+)\}\}/g, (_, key) =>
    String(record?.[key] ?? '')
  );
  return template;
}

/** Human-readable summary of the record's current known fields. */
export function buildRecordContext(record, schema) {
  if (!record) return '';
  const lines = [];
  for (const f of schema?.fields ?? []) {
    const val = record[f.key];
    if (val == null || val === '' || f.type === 'encrypted') continue;
    lines.push(`${f.label || f.key}: ${val}`);
  }
  return lines.join('\n');
}

/** Prompt for summarizing a whole record. */
export function buildSummaryPrompt(record, schema) {
  return (
    `Summarize the following ${schema?.title || 'record'} in 1-2 sentences:\n\n` +
    buildRecordContext(record, schema)
  );
}
