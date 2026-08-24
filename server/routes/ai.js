// server/routes/ai.js
// AI execution endpoints backed by the unified provider proxy.

import { generate, extract, AiError } from '../ai-proxy.js';
import { sendJson, readJsonBody } from '../http-util.js';

export async function handleAiRoutes(req, res, url) {
  const { pathname } = url;
  if (req.method !== 'POST') return false;

  try {
    if (pathname === '/api/ai/generate') {
      const body = await readJsonBody(req);
      if (!body?.prompt) {
        sendJson(res, 400, { error: 'prompt is required.' });
        return true;
      }
      const result = await generate(body);
      sendJson(res, 200, result);
      return true;
    }

    if (pathname === '/api/ai/extract') {
      const body = await readJsonBody(req);
      if (!body?.text || !body?.schema) {
        sendJson(res, 400, { error: 'text and schema are required.' });
        return true;
      }
      const result = await extract(body);
      sendJson(res, 200, result);
      return true;
    }
  } catch (err) {
    const status = err instanceof AiError ? err.status : 502;
    sendJson(res, status, { error: err.message });
    return true;
  }

  return false;
}
