// server/db.js
// Embedded persistence layer for Foremark using better-sqlite3.
// Handles schema creation and CRUD for templates, records, and vault settings.

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

let db = null;

/**
 * Open (and lazily initialise) the SQLite database inside DATA_DIR.
 * @param {string} dataDir absolute or relative directory for the db file
 * @returns {import('better-sqlite3').Database}
 */
export function initDb(dataDir = process.env.DATA_DIR || './data') {
  if (db) return db;

  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'waymark.db');

  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id          TEXT PRIMARY KEY,
      schema_json TEXT NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS records (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      data_json   TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_records_template
      ON records(template_id);

    CREATE TABLE IF NOT EXISTS vault_settings (
      id          TEXT PRIMARY KEY,
      config_json TEXT NOT NULL
    );
  `);

  // Migration: track demo-generated records so Demo Mode can remove them.
  const cols = db.prepare('PRAGMA table_info(records)').all();
  if (!cols.some((c) => c.name === 'is_demo')) {
    db.exec('ALTER TABLE records ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0');
  }

  return db;
}

function getDb() {
  if (!db) initDb();
  return db;
}

const now = () => Date.now();
const newId = () => crypto.randomUUID();

// ── Templates ───────────────────────────────────────────────────────────

export function upsertTemplate(id, schema) {
  const database = getDb();
  const templateId = id || schema?.id || newId();
  const payload = JSON.stringify({ ...schema, id: templateId });
  database
    .prepare(
      `INSERT INTO templates (id, schema_json, updated_at)
       VALUES (@id, @schema_json, @updated_at)
       ON CONFLICT(id) DO UPDATE SET
         schema_json = excluded.schema_json,
         updated_at  = excluded.updated_at`
    )
    .run({ id: templateId, schema_json: payload, updated_at: now() });
  return getTemplate(templateId);
}

export function getTemplate(id) {
  const row = getDb().prepare('SELECT * FROM templates WHERE id = ?').get(id);
  return row ? rowToTemplate(row) : null;
}

export function listTemplates() {
  return getDb()
    .prepare('SELECT * FROM templates ORDER BY updated_at DESC')
    .all()
    .map(rowToTemplate);
}

export function deleteTemplate(id) {
  const info = getDb().prepare('DELETE FROM templates WHERE id = ?').run(id);
  return info.changes > 0;
}

function rowToTemplate(row) {
  return {
    id: row.id,
    schema: JSON.parse(row.schema_json),
    updatedAt: row.updated_at,
  };
}

// ── Records ─────────────────────────────────────────────────────────────

export function createRecord(templateId, data) {
  const database = getDb();
  const id = newId();
  const ts = now();
  database
    .prepare(
      `INSERT INTO records (id, template_id, data_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, templateId, JSON.stringify(data ?? {}), ts, ts);
  return getRecord(id);
}

/**
 * Insert many records for a template in a single transaction.
 * @param {string} templateId
 * @param {Array<object>} rows  array of `data` objects
 * @param {boolean} [demo=false]  tag these as demo-generated records
 * @returns {Array} created records
 */
export function createManyRecords(templateId, rows, demo = false) {
  const database = getDb();
  const insert = database.prepare(
    `INSERT INTO records (id, template_id, data_json, created_at, updated_at, is_demo)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const ids = [];
  const tx = database.transaction((items) => {
    for (const data of items) {
      const id = newId();
      const ts = now();
      insert.run(id, templateId, JSON.stringify(data ?? {}), ts, ts, demo ? 1 : 0);
      ids.push(id);
    }
  });
  tx(rows ?? []);
  return ids.map(getRecord);
}

export function getRecord(id) {
  const row = getDb().prepare('SELECT * FROM records WHERE id = ?').get(id);
  return row ? rowToRecord(row) : null;
}

export function listRecords(templateId) {
  const database = getDb();
  const rows = templateId
    ? database
        .prepare(
          'SELECT * FROM records WHERE template_id = ? ORDER BY updated_at DESC'
        )
        .all(templateId)
    : database.prepare('SELECT * FROM records ORDER BY updated_at DESC').all();
  return rows.map(rowToRecord);
}

export function updateRecord(id, data) {
  const database = getDb();
  const existing = getRecord(id);
  if (!existing) return null;
  const merged = { ...existing.data, ...data };
  database
    .prepare('UPDATE records SET data_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(merged), now(), id);
  return getRecord(id);
}

export function deleteRecord(id) {
  const info = getDb().prepare('DELETE FROM records WHERE id = ?').run(id);
  return info.changes > 0;
}

/** Delete all records belonging to a template. Returns the count removed. */
export function deleteRecordsByTemplate(templateId) {
  const info = getDb()
    .prepare('DELETE FROM records WHERE template_id = ?')
    .run(templateId);
  return info.changes;
}

/**
 * Delete demo-generated records, optionally scoped to one template.
 * @param {string} [templateId]
 * @returns {number} count removed
 */
export function deleteDemoRecords(templateId) {
  const database = getDb();
  const info = templateId
    ? database
        .prepare('DELETE FROM records WHERE is_demo = 1 AND template_id = ?')
        .run(templateId)
    : database.prepare('DELETE FROM records WHERE is_demo = 1').run();
  return info.changes;
}

/**
 * Naive full-text-ish search across a record's serialised JSON.
 * @param {string} templateId
 * @param {string} term
 */
export function searchRecords(templateId, term) {
  const like = `%${term}%`;
  return getDb()
    .prepare(
      `SELECT * FROM records
       WHERE template_id = ? AND data_json LIKE ?
       ORDER BY updated_at DESC`
    )
    .all(templateId, like)
    .map(rowToRecord);
}

function rowToRecord(row) {
  return {
    id: row.id,
    templateId: row.template_id,
    data: JSON.parse(row.data_json),
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Vault settings ──────────────────────────────────────────────────────

export function getVaultSetting(id) {
  const row = getDb()
    .prepare('SELECT * FROM vault_settings WHERE id = ?')
    .get(id);
  return row ? JSON.parse(row.config_json) : null;
}

export function setVaultSetting(id, config) {
  getDb()
    .prepare(
      `INSERT INTO vault_settings (id, config_json)
       VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json`
    )
    .run(id, JSON.stringify(config));
  return config;
}

// ── Import / export helpers ─────────────────────────────────────────────

export function exportAll() {
  return {
    exportedAt: now(),
    version: 1,
    templates: listTemplates(),
    records: listRecords(),
  };
}

export function importAll(payload) {
  const database = getDb();
  const tx = database.transaction((data) => {
    for (const t of data.templates ?? []) {
      upsertTemplate(t.id, t.schema ?? t);
    }
    for (const r of data.records ?? []) {
      const ts = now();
      database
        .prepare(
          `INSERT INTO records (id, template_id, data_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             data_json  = excluded.data_json,
             updated_at = excluded.updated_at`
        )
        .run(
          r.id || newId(),
          r.templateId || r.template_id,
          JSON.stringify(r.data ?? {}),
          r.createdAt || ts,
          r.updatedAt || ts
        );
    }
  });
  tx(payload);
  return exportAll();
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
