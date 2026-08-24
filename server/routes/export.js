// server/routes/export.js
// Data export/import: JSON backup, CSV bulk export, and printable HTML summary.

import * as db from '../db.js';
import { sendJson, readJsonBody } from '../http-util.js';

export async function handleExportRoutes(req, res, url) {
  const { pathname } = url;
  const method = req.method;

  // Full JSON backup of everything.
  if (pathname === '/api/export/json' && method === 'GET') {
    const payload = db.exportAll();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="foremark-backup.json"',
    });
    res.end(JSON.stringify(payload, null, 2));
    return true;
  }

  // Restore from a JSON backup.
  if (pathname === '/api/import/json' && method === 'POST') {
    const body = await readJsonBody(req);
    if (!body || (!body.templates && !body.records)) {
      sendJson(res, 400, { error: 'Invalid backup payload.' });
      return true;
    }
    const result = db.importAll(body);
    sendJson(res, 200, {
      imported: {
        templates: result.templates.length,
        records: result.records.length,
      },
    });
    return true;
  }

  // CSV export for a single template's records.
  if (pathname === '/api/export/csv' && method === 'GET') {
    const templateId = url.searchParams.get('templateId');
    if (!templateId) {
      sendJson(res, 400, { error: 'templateId query param is required.' });
      return true;
    }
    const template = db.getTemplate(templateId);
    const records = db.listRecords(templateId);
    const csv = toCsv(template, records);
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${templateId}.csv"`,
    });
    res.end(csv);
    return true;
  }

  // Printable HTML summary (browser can "Print to PDF").
  if (pathname === '/api/export/html' && method === 'GET') {
    const templateId = url.searchParams.get('templateId');
    if (!templateId) {
      sendJson(res, 400, { error: 'templateId query param is required.' });
      return true;
    }
    const template = db.getTemplate(templateId);
    const records = db.listRecords(templateId);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(toPrintableHtml(template, records));
    return true;
  }

  return false;
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(template, records) {
  const keys =
    template?.schema?.fields?.map((f) => f.key) ??
    [...new Set(records.flatMap((r) => Object.keys(r.data)))];
  const header = ['id', ...keys, 'createdAt', 'updatedAt'];
  const lines = [header.map(csvEscape).join(',')];
  for (const r of records) {
    const row = [
      r.id,
      ...keys.map((k) => r.data[k]),
      new Date(r.createdAt).toISOString(),
      new Date(r.updatedAt).toISOString(),
    ];
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\n');
}

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function toPrintableHtml(template, records) {
  const title = template?.schema?.title ?? 'Records';
  const keys =
    template?.schema?.fields?.map((f) => ({ key: f.key, label: f.label || f.key })) ??
    [...new Set(records.flatMap((r) => Object.keys(r.data)))].map((k) => ({
      key: k,
      label: k,
    }));
  const rows = records
    .map(
      (r) =>
        `<tr>${keys
          .map((k) => `<td>${htmlEscape(r.data[k.key])}</td>`)
          .join('')}</tr>`
    )
    .join('');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${htmlEscape(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
  h1 { font-size: 1.4rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  @media print { button { display: none; } }
</style></head>
<body>
  <h1>${htmlEscape(title)}</h1>
  <p>${records.length} record(s) &middot; generated ${new Date().toLocaleString()}</p>
  <table>
    <thead><tr>${keys.map((k) => `<th>${htmlEscape(k.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;
}
