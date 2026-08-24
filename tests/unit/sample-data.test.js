// tests/unit/sample-data.test.js
// Verify the demo-mode sample data generator produces coherent, valid values.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateRecords,
  generateValue,
  makeSecret,
  architectureSample,
} from '../../public/js/data/sample-data.js';
import { BUILTIN_TEMPLATES } from '../../public/js/templates/registry.js';

test('generateRecords returns the requested count for every built-in', () => {
  for (const t of BUILTIN_TEMPLATES) {
    if (t.id === 'architecture') continue; // fixed curated set, count ignored
    const rows = generateRecords(t, 7);
    assert.equal(rows.length, 7, `${t.id} count`);
  }
});

test('select/status values are always drawn from the field options', () => {
  const issues = BUILTIN_TEMPLATES.find((t) => t.id === 'issue-tracker');
  const rows = generateRecords(issues, 40);
  const statusOpts = issues.fields.find((f) => f.key === 'status').options;
  const prioOpts = issues.fields.find((f) => f.key === 'priority').options;
  for (const r of rows) {
    assert.ok(statusOpts.includes(r.status), `status ${r.status}`);
    assert.ok(prioOpts.includes(r.priority), `priority ${r.priority}`);
  }
});

test('encrypted fields are left empty by the generator', () => {
  const vaultTpl = BUILTIN_TEMPLATES.find((t) => t.id === 'secrets-vault');
  const rows = generateRecords(vaultTpl, 10);
  for (const r of rows) {
    assert.ok(!('secret' in r), 'encrypted field omitted');
  }
});

test('number fields generate numbers in sensible ranges', () => {
  const field = { key: 'amount', label: 'Amount', type: 'number' };
  for (let i = 0; i < 20; i++) {
    const v = generateValue(field, {});
    assert.equal(typeof v, 'number');
    assert.ok(v >= 0 && v < 1000, `amount in range: ${v}`);
  }
  const qty = { key: 'quantity', type: 'number' };
  for (let i = 0; i < 20; i++) {
    const v = generateValue(qty, {});
    assert.ok(Number.isInteger(v) && v >= 1, `qty int: ${v}`);
  }
});

test('email values are coherent with the record person context', () => {
  const ctx = {};
  const name = generateValue({ key: 'name', type: 'text' }, ctx);
  const email = generateValue({ key: 'email', type: 'text' }, ctx);
  assert.match(email, /@.+\..+/);
  const first = name.split(' ')[0].toLowerCase();
  assert.ok(email.startsWith(first), `email ${email} matches ${name}`);
});

test('date fields return ISO date strings', () => {
  const v = generateValue({ key: 'date', type: 'date' }, {});
  assert.match(v, /^\d{4}-\d{2}-\d{2}$/);
  const due = generateValue({ key: 'dueDate', type: 'date' }, {});
  assert.match(due, /^\d{4}-\d{2}-\d{2}$/);
});

test('makeSecret returns a grouped token', () => {
  const s = makeSecret();
  assert.match(s, /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
});

test('architecture template returns the curated fixed diagram', () => {
  const arch = BUILTIN_TEMPLATES.find((t) => t.id === 'architecture');
  const rows = generateRecords(arch, 3); // count is ignored for architecture
  assert.equal(rows.length, architectureSample().length);
  assert.ok(rows.length > 5);
  // Every node has a name and a known layer.
  const layers = new Set(['client', 'edge', 'application', 'data', 'external']);
  for (const r of rows) {
    assert.ok(r.name, 'node has a name');
    assert.ok(layers.has(r.layer), `known layer: ${r.layer}`);
  }
});

test('architecture connections reference real node names', () => {
  const rows = architectureSample();
  const names = new Set(rows.map((r) => r.name.toLowerCase()));
  for (const r of rows) {
    const targets = String(r.connectsTo || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    for (const t of targets) {
      assert.ok(names.has(t), `"${r.name}" connects to real node "${t}"`);
    }
  }
});
