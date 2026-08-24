// server/server.js
// Lightweight native-HTTP server: static asset host + REST API router.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { initDb, closeDb } from './db.js';
import { sendJson } from './http-util.js';
import { handleRecordsRoutes } from './routes/records.js';
import { handleAiRoutes } from './routes/ai.js';
import { handleExportRoutes } from './routes/export.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;

initDb(process.env.DATA_DIR || './data');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    // ── API routing ─────────────────────────────────────────────────────
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/health') {
        return sendJson(res, 200, { status: 'ok', time: Date.now() });
      }
      if (url.pathname === '/api/config') {
        return sendJson(res, 200, {
          defaultProvider: process.env.DEFAULT_AI_PROVIDER || 'openai',
          providers: {
            openai: Boolean(process.env.OPENAI_API_KEY),
            anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
            gemini: Boolean(process.env.GEMINI_API_KEY),
            ollama: true,
          },
        });
      }

      if (await handleRecordsRoutes(req, res, url)) return;
      if (await handleAiRoutes(req, res, url)) return;
      if (await handleExportRoutes(req, res, url)) return;

      return sendJson(res, 404, { error: 'Not found.' });
    }

    // ── Static assets ───────────────────────────────────────────────────
    await serveStatic(req, res, url);
  } catch (err) {
    console.error('[server] Unhandled error:', err);
    if (!res.headersSent) sendJson(res, 500, { error: err.message });
  }
});

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';

  // Prevent path traversal.
  const safePath = path
    .normalize(pathname)
    .replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: 'Forbidden.' });
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback -> index.html
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (e, data) => {
        if (e) return sendJson(res, 404, { error: 'Not found.' });
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(data);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

server.listen(PORT, () => {
  console.log(`\n  Foremark running at http://localhost:${PORT}`);
  console.log(`  Data directory: ${process.env.DATA_DIR || './data'}\n`);
});

function shutdown() {
  console.log('\n  Shutting down…');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { server };
