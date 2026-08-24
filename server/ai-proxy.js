// server/ai-proxy.js
// Unified backend proxy for multiple AI providers.
// Normalises request/response shapes across OpenAI, Anthropic, Gemini, and Ollama.
//
// Exposes two high-level operations:
//   generate({ provider, model, system, prompt })  -> { text, provider, model }
//   extract ({ provider, model, schema, text })     -> { data, provider, model }
//
// Keys are read from environment variables but can be overridden per-request
// (e.g. from the client's settings UI) via the `apiKey` field.

const DEFAULTS = {
  openai: { model: () => process.env.OPENAI_MODEL || 'gpt-4o-mini' },
  anthropic: {
    model: () => process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
  },
  gemini: { model: () => process.env.GEMINI_MODEL || 'gemini-flash-latest' },
  ollama: { model: () => process.env.OLLAMA_MODEL || 'llama3.1' },
};

export function resolveProvider(requested) {
  const provider =
    requested || process.env.DEFAULT_AI_PROVIDER || 'openai';
  if (!DEFAULTS[provider]) {
    throw new AiError(`Unknown AI provider: ${provider}`, 400);
  }
  return provider;
}

export class AiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'AiError';
    this.status = status;
  }
}

function keyFor(provider, override) {
  if (override) return override;
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'gemini':
      return process.env.GEMINI_API_KEY;
    case 'ollama':
      return null; // Ollama needs no key.
    default:
      return null;
  }
}

/**
 * Low-level chat completion returning plain text.
 */
export async function generate({
  provider,
  model,
  system,
  prompt,
  apiKey,
  baseUrl,
  temperature = 0.4,
} = {}) {
  const p = resolveProvider(provider);
  const chosenModel = model || DEFAULTS[p].model();
  const key = keyFor(p, apiKey);

  if (p !== 'ollama' && !key) {
    throw new AiError(
      `No API key configured for provider "${p}". Set it in Settings or the .env file.`,
      400
    );
  }

  switch (p) {
    case 'openai':
      return wrap(p, chosenModel, await callOpenAI({ key, model: chosenModel, system, prompt, temperature }));
    case 'anthropic':
      return wrap(p, chosenModel, await callAnthropic({ key, model: chosenModel, system, prompt, temperature }));
    case 'gemini':
      return wrap(p, chosenModel, await callGemini({ key, model: chosenModel, system, prompt, temperature }));
    case 'ollama':
      return wrap(p, chosenModel, await callOllama({ baseUrl, model: chosenModel, system, prompt, temperature }));
    default:
      throw new AiError(`Unsupported provider: ${p}`, 400);
  }
}

function wrap(provider, model, text) {
  return { text: (text || '').trim(), provider, model };
}

/**
 * Structured extraction: instructs the model to return JSON that conforms to
 * the provided field schema, then parses it defensively.
 * @param {{fields: Array<{key:string,label?:string,type?:string}>}} schema
 */
export async function extract({ provider, model, schema, text, apiKey, baseUrl } = {}) {
  const fields = schema?.fields ?? [];
  const fieldList = fields
    .map((f) => `- "${f.key}" (${f.type || 'text'})${f.label ? `: ${f.label}` : ''}`)
    .join('\n');

  const system =
    'You are a precise data-extraction engine. Read the unstructured input ' +
    'and return ONLY a JSON object (or an array of objects for multiple ' +
    'records) whose keys match the requested field keys. Do not include ' +
    'markdown fences, commentary, or explanations. Use empty strings for ' +
    'unknown values.';

  const prompt =
    `Target fields:\n${fieldList}\n\n` +
    `Unstructured input:\n"""\n${text}\n"""\n\n` +
    'Return the JSON now.';

  const result = await generate({
    provider,
    model,
    system,
    prompt,
    apiKey,
    baseUrl,
    temperature: 0,
  });

  const data = parseJsonLoose(result.text);
  return { data, provider: result.provider, model: result.model, raw: result.text };
}

/**
 * Extract a JSON value from a model response that may contain fences or prose.
 */
export function parseJsonLoose(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/^```(?:json)?/im, '')
    .replace(/```$/m, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt to locate the first balanced JSON object/array.
    const start = cleaned.search(/[[{]/);
    if (start === -1) return null;
    const open = cleaned[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === open) depth++;
      else if (cleaned[i] === close) depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}

// ── Provider adapters ───────────────────────────────────────────────────

async function callOpenAI({ key, model, system, prompt, temperature }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
    }),
  });
  const json = await safeJson(res);
  if (!res.ok) throw new AiError(providerMessage('OpenAI', res, json), res.status);
  return json?.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic({ key, model, system, prompt, temperature }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const json = await safeJson(res);
  if (!res.ok) throw new AiError(providerMessage('Anthropic', res, json), res.status);
  return json?.content?.map((c) => c.text).join('') ?? '';
}

async function callGemini({ key, model, system, prompt, temperature }) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature },
    }),
  });
  const json = await safeJson(res);
  if (!res.ok) throw new AiError(providerMessage('Gemini', res, json), res.status);
  return (
    json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
  );
}

async function callOllama({ baseUrl, model, system, prompt, temperature }) {
  const base = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const res = await fetch(`${base.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature },
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
    }),
  });
  const json = await safeJson(res);
  if (!res.ok) throw new AiError(providerMessage('Ollama', res, json), res.status);
  return json?.message?.content ?? '';
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function providerMessage(name, res, json) {
  const detail =
    json?.error?.message || json?.error || json?.message || res.statusText;
  return `${name} request failed (${res.status}): ${detail}`;
}
