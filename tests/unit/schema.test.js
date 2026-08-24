// tests/unit/schema.test.js
// Template validation & registry tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BUILTIN_TEMPLATES,
  validateTemplate,
  primaryField,
  statusField,
  cloneTemplate,
  FIELD_TYPES,
} from '../../public/js/templates/registry.js';

test('all built-in templates are valid', () => {
  for (const t of BUILTIN_TEMPLATES) {
    const { valid, errors } = validateTemplate(t);
    assert.ok(valid, `${t.id}: ${errors.join('; ')}`);
  }
});

test('validateTemplate rejects a template with no fields', () => {
  const { valid, errors } = validateTemplate({ title: 'x', fields: [], views: ['table'] });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => /at least one field/.test(e)));
});

test('validateTemplate rejects duplicate field keys', () => {
  const { valid, errors } = validateTemplate({
    title: 'Dup',
    views: ['table'],
    fields: [
      { key: 'a', type: 'text' },
      { key: 'a', type: 'text' },
    ],
  });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => /Duplicate field key/.test(e)));
});

test('validateTemplate rejects invalid field types', () => {
  const { valid } = validateTemplate({
    title: 'Bad',
    views: ['table'],
    fields: [{ key: 'a', type: 'quantum' }],
  });
  assert.equal(valid, false);
});

test('select/status fields require options', () => {
  const { valid, errors } = validateTemplate({
    title: 'Sel',
    views: ['table'],
    fields: [{ key: 's', type: 'select' }],
  });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => /requires "options"/.test(e)));
});

test('validateTemplate requires at least one view', () => {
  const { valid } = validateTemplate({
    title: 'NoView',
    views: [],
    fields: [{ key: 'a', type: 'text' }],
  });
  assert.equal(valid, false);
});

test('primaryField returns the primary or first field', () => {
  const issues = BUILTIN_TEMPLATES.find((t) => t.id === 'issue-tracker');
  assert.equal(primaryField(issues).key, 'subject');
  const noPrimary = { fields: [{ key: 'first' }, { key: 'second' }] };
  assert.equal(primaryField(noPrimary).key, 'first');
});

test('statusField finds the status-typed field', () => {
  const issues = BUILTIN_TEMPLATES.find((t) => t.id === 'issue-tracker');
  assert.equal(statusField(issues).key, 'status');
  const meeting = BUILTIN_TEMPLATES.find((t) => t.id === 'meeting-notes');
  assert.equal(statusField(meeting), undefined);
});

test('cloneTemplate returns an independent deep copy', () => {
  const a = cloneTemplate('secrets-vault');
  a.title = 'Changed';
  a.fields[0].label = 'Mutated';
  const b = cloneTemplate('secrets-vault');
  assert.notEqual(b.title, 'Changed');
  assert.notEqual(b.fields[0].label, 'Mutated');
});

test('the secrets vault has an encrypted field', () => {
  const vault = BUILTIN_TEMPLATES.find((t) => t.id === 'secrets-vault');
  assert.ok(vault.fields.some((f) => f.type === 'encrypted'));
});

test('FIELD_TYPES includes the documented types', () => {
  for (const t of ['text', 'textarea', 'select', 'number', 'date', 'status', 'encrypted', 'file']) {
    assert.ok(FIELD_TYPES.includes(t), `missing ${t}`);
  }
});
