// server/routes/records.js
// CRUD routes for templates and records.

import * as db from '../db.js';
import { sendJson, readJsonBody } from '../http-util.js';

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {URL} url
 * @returns {Promise<boolean>} true if the route was handled
 */
export async function handleRecordsRoutes(req, res, url) {
  const { pathname } = url;
  const method = req.method;

  // ── Templates ─────────────────────────────────────────────────────────
  if (pathname === '/api/templates') {
    if (method === 'GET') {
      sendJson(res, 200, { templates: db.listTemplates() });
      return true;
    }
    if (method === 'POST') {
      const body = await readJsonBody(req);
      const schema = body?.schema ?? body;
      if (!schema || !schema.fields) {
        sendJson(res, 400, { error: 'Template must include a fields array.' });
        return true;
      }
      const saved = db.upsertTemplate(body?.id ?? schema.id, schema);
      sendJson(res, 200, { template: saved });
      return true;
    }
  }

  const templateMatch = pathname.match(/^\/api\/templates\/([^/]+)$/);
  if (templateMatch) {
    const id = decodeURIComponent(templateMatch[1]);
    if (method === 'GET') {
      const t = db.getTemplate(id);
      if (!t) return sendJson(res, 404, { error: 'Template not found.' }), true;
      sendJson(res, 200, { template: t });
      return true;
    }
    if (method === 'DELETE') {
      const ok = db.deleteTemplate(id);
      sendJson(res, ok ? 200 : 404, { deleted: ok });
      return true;
    }
  }

  // ── Records ───────────────────────────────────────────────────────────
  if (pathname === '/api/records') {
    if (method === 'GET') {
      const templateId = url.searchParams.get('templateId') || undefined;
      const q = url.searchParams.get('q');
      const records =
        q && templateId
          ? db.searchRecords(templateId, q)
          : db.listRecords(templateId);
      sendJson(res, 200, { records });
      return true;
    }
    if (method === 'POST') {
      const body = await readJsonBody(req);
      if (!body?.templateId) {
        sendJson(res, 400, { error: 'templateId is required.' });
        return true;
      }
      const record = db.createRecord(body.templateId, body.data ?? {});
      sendJson(res, 201, { record });
      return true;
    }
    if (method === 'DELETE') {
      const templateId = url.searchParams.get('templateId') || undefined;
      const demoOnly = url.searchParams.get('demo') === 'true';
      if (demoOnly) {
        const deleted = db.deleteDemoRecords(templateId);
        sendJson(res, 200, { deleted });
        return true;
      }
      if (!templateId) {
        sendJson(res, 400, { error: 'templateId query param is required.' });
        return true;
      }
      const deleted = db.deleteRecordsByTemplate(templateId);
      sendJson(res, 200, { deleted });
      return true;
    }
  }

  // Bulk insert (Demo Mode / import helpers).
  if (pathname === '/api/records/bulk' && method === 'POST') {
    const body = await readJsonBody(req);
    if (!body?.templateId || !Array.isArray(body.rows)) {
      sendJson(res, 400, { error: 'templateId and rows[] are required.' });
      return true;
    }
    const records = db.createManyRecords(
      body.templateId,
      body.rows,
      body.demo === true
    );
    sendJson(res, 201, { records });
    return true;
  }

  const recordMatch = pathname.match(/^\/api\/records\/([^/]+)$/);
  if (recordMatch) {
    const id = decodeURIComponent(recordMatch[1]);
    if (method === 'GET') {
      const r = db.getRecord(id);
      if (!r) return sendJson(res, 404, { error: 'Record not found.' }), true;
      sendJson(res, 200, { record: r });
      return true;
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = await readJsonBody(req);
      const updated = db.updateRecord(id, body?.data ?? {});
      if (!updated) return sendJson(res, 404, { error: 'Record not found.' }), true;
      sendJson(res, 200, { record: updated });
      return true;
    }
    if (method === 'DELETE') {
      const ok = db.deleteRecord(id);
      sendJson(res, ok ? 200 : 404, { deleted: ok });
      return true;
    }
  }

  // ── Vault settings ────────────────────────────────────────────────────
  if (pathname === '/api/vault/settings') {
    if (method === 'GET') {
      sendJson(res, 200, { settings: db.getVaultSetting('vault') ?? {} });
      return true;
    }
    if (method === 'POST' || method === 'PUT') {
      const body = await readJsonBody(req);
      const saved = db.setVaultSetting('vault', body ?? {});
      sendJson(res, 200, { settings: saved });
      return true;
    }
  }

  return false;
}
