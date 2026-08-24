// public/js/templates/form-view.js
// Dynamic form view with per-field AI "magic wand" fill and encryption.

import { vault, isEncrypted } from '../crypto/vault.js';
import { aiClient } from '../ai/ai-client.js';
import { toast } from '../ui/toast.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/**
 * Render an editable form for a single record.
 * @param {object} ctx
 * @param {object} ctx.schema
 * @param {object} ctx.record   { id, data }
 * @param {(id,data)=>Promise} ctx.onUpdate
 */
export function renderFormView({ schema, record, onUpdate }) {
  const form = el('div', 'form-view');
  const title = el('h3', null, schema.title);
  form.appendChild(title);

  const draft = { ...record.data };

  for (const field of schema.fields) {
    form.appendChild(renderField(field, draft, record, schema, onUpdate));
  }

  const bar = el('div', 'toolbar');
  bar.style.marginTop = 'var(--space-4)';
  const saveBtn = el('button', 'btn btn-primary', 'Save all');
  saveBtn.addEventListener('click', async () => {
    try {
      await onUpdate(record.id, draft);
      toast.success('Saved');
    } catch (e) {
      toast.error(e.message);
    }
  });
  bar.appendChild(saveBtn);
  form.appendChild(bar);
  return form;
}

function renderField(field, draft, record, schema, onUpdate) {
  const wrap = el('div', 'form-field');
  const head = el('div', 'field-head');
  const label = el('label', null, field.label || field.key);
  if (field.type === 'encrypted') {
    const lock = el('span', 'lock-icon', ' 🔒');
    label.appendChild(lock);
  }
  head.appendChild(label);
  wrap.appendChild(head);

  const row = el('div', 'field-input-wrap');

  if (field.type === 'encrypted') {
    row.appendChild(renderEncryptedField(field, draft));
  } else if (field.type === 'textarea') {
    const ta = el('textarea');
    ta.value = draft[field.key] ?? '';
    ta.addEventListener('input', () => (draft[field.key] = ta.value));
    row.appendChild(ta);
    row.appendChild(magicButton(field, draft, schema, ta));
  } else if (field.type === 'select' || field.type === 'status') {
    const sel = el('select');
    sel.appendChild(el('option', null, '—'));
    for (const opt of field.options || []) {
      const o = el('option', null, opt);
      o.value = opt;
      if (opt === draft[field.key]) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => (draft[field.key] = sel.value));
    row.appendChild(sel);
  } else {
    const input = el('input');
    input.type =
      field.type === 'number'
        ? 'number'
        : field.type === 'date'
        ? 'date'
        : 'text';
    input.value = draft[field.key] ?? '';
    input.addEventListener('input', () => (draft[field.key] = input.value));
    row.appendChild(input);
    if (field.type !== 'date' && field.type !== 'file') {
      row.appendChild(magicButton(field, draft, schema, input));
    }
  }

  wrap.appendChild(row);
  return wrap;
}

function renderEncryptedField(field, draft) {
  const input = el('input');
  input.type = 'password';
  input.placeholder = isEncrypted(draft[field.key])
    ? '•••••••• (encrypted — type to replace)'
    : 'Enter value to encrypt';

  input.addEventListener('change', async () => {
    if (!input.value) return;
    if (!vault.isUnlocked) {
      toast.error('Unlock the vault first.');
      return;
    }
    draft[field.key] = await vault.encryptValue(input.value);
    input.value = '';
    input.placeholder = '•••••••• (encrypted — type to replace)';
    toast.success(`${field.label || field.key} encrypted`);
  });
  return input;
}

function magicButton(field, draft, schema, target) {
  const btn = el('button', 'magic-btn');
  btn.type = 'button';
  btn.innerHTML = '✨';
  btn.title = 'Generate with AI';
  btn.addEventListener('click', async () => {
    btn.classList.add('busy');
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      const text = await aiClient.fillField(field, draft, schema);
      target.value = text;
      draft[field.key] = text;
      toast.success(`Generated "${field.label || field.key}"`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      btn.classList.remove('busy');
      btn.innerHTML = '✨';
    }
  });
  return btn;
}
