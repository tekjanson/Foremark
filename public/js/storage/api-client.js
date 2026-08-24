// public/js/storage/api-client.js
// Thin REST client for the Foremark server.

async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const isJson = (res.headers.get('content-type') || '').includes(
    'application/json'
  );
  const payload = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message =
      (isJson && payload && payload.error) || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }
  return payload;
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),

  // ── Domain helpers ────────────────────────────────────────────────────
  listTemplates: () => request('GET', '/api/templates'),
  saveTemplate: (schema) => request('POST', '/api/templates', schema),
  deleteTemplate: (id) => request('DELETE', `/api/templates/${encodeURIComponent(id)}`),

  listRecords: (templateId, q) => {
    const params = new URLSearchParams();
    if (templateId) params.set('templateId', templateId);
    if (q) params.set('q', q);
    const qs = params.toString();
    return request('GET', `/api/records${qs ? `?${qs}` : ''}`);
  },
  createRecord: (templateId, data) =>
    request('POST', '/api/records', { templateId, data }),
  bulkCreateRecords: (templateId, rows, demo = false) =>
    request('POST', '/api/records/bulk', { templateId, rows, demo }),
  clearRecords: (templateId) =>
    request('DELETE', `/api/records?templateId=${encodeURIComponent(templateId)}`),
  deleteDemoRecords: (templateId) =>
    request(
      'DELETE',
      `/api/records?demo=true${templateId ? `&templateId=${encodeURIComponent(templateId)}` : ''}`
    ),
  updateRecord: (id, data) =>
    request('PUT', `/api/records/${encodeURIComponent(id)}`, { data }),
  deleteRecord: (id) => request('DELETE', `/api/records/${encodeURIComponent(id)}`),

  aiGenerate: (payload) => request('POST', '/api/ai/generate', payload),
  aiExtract: (payload) => request('POST', '/api/ai/extract', payload),

  getConfig: () => request('GET', '/api/config'),
};
