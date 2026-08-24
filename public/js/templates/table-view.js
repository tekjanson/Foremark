// public/js/templates/table-view.js
// Dynamic spreadsheet/grid view with inline editing, AI fill, and encryption.

import { vault, isEncrypted } from '../crypto/vault.js';
import { aiClient } from '../ai/ai-client.js';
import { toast } from '../ui/toast.js';
import { openModal, confirmModal } from '../ui/modal.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/**
 * @param {object} ctx
 * @param {object} ctx.schema  template schema
 * @param {Array}  ctx.records
 * @param {(id, data)=>Promise} ctx.onUpdate
 * @param {(id)=>Promise} ctx.onDelete
 * @returns {HTMLElement}
 */
export function renderTableView({ schema, records, onUpdate, onDelete }) {
  const wrap = el('div', 'data-table-wrap');
  const table = el('table', 'data-table');

  // Header
  const thead = el('thead');
  const hr = el('tr');
  for (const f of schema.fields) {
    const th = el('th');
    th.textContent = f.label || f.key;
    if (f.type === 'encrypted') th.append(' ', lockBadge());
    hr.appendChild(th);
  }
  hr.appendChild(el('th', null, ''));
  thead.appendChild(hr);
  table.appendChild(thead);

  // Body
  const tbody = el('tbody');
  for (const record of records) {
    tbody.appendChild(renderRow(record, schema, { onUpdate, onDelete }));
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function lockBadge() {
  const s = el('span', 'lock-icon');
  s.textContent = '🔒';
  s.title = 'Encrypted field';
  return s;
}

function renderRow(record, schema, { onUpdate, onDelete }) {
  const tr = el('tr');
  tr.dataset.id = record.id;

  for (const field of schema.fields) {
    const td = el('td');
    td.appendChild(renderCell(field, record, schema, onUpdate));
    tr.appendChild(td);
  }

  // Actions
  const actionsTd = el('td');
  const actions = el('div', 'row-actions');
  const delBtn = el('button', 'btn btn-ghost btn-sm', '🗑');
  delBtn.title = 'Delete record';
  delBtn.addEventListener('click', async () => {
    if (await confirmModal('Delete this record?', { danger: true })) {
      await onDelete(record.id);
      tr.remove();
      toast.success('Record deleted');
    }
  });
  actions.appendChild(delBtn);
  actionsTd.appendChild(actions);
  tr.appendChild(actionsTd);
  return tr;
}

function renderCell(field, record, schema, onUpdate) {
  const value = record.data[field.key];

  if (field.type === 'encrypted') {
    return renderEncryptedCell(field, record, onUpdate);
  }

  if (field.type === 'select' || field.type === 'status') {
    const select = el('select', 'cell-input');
    for (const opt of field.options || []) {
      const o = el('option', null, opt);
      o.value = opt;
      if (opt === value) o.selected = true;
      select.appendChild(o);
    }
    if (value == null) select.value = '';
    select.addEventListener('change', () =>
      commit(record, field.key, select.value, onUpdate)
    );
    return select;
  }

  const input = el('input', 'cell-input');
  input.type =
    field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
  input.value = value ?? '';
  input.addEventListener('change', () =>
    commit(record, field.key, input.value, onUpdate)
  );

  // Magic-wand AI fill for text-like fields with a prompt.
  if (['text', 'textarea', 'number'].includes(field.type)) {
    const wrapEl = el('div', 'field-input-wrap');
    wrapEl.appendChild(input);
    wrapEl.appendChild(magicButton(field, record, schema, input, onUpdate));
    return wrapEl;
  }
  return input;
}

function renderEncryptedCell(field, record, onUpdate) {
  const container = el('div', 'field-input-wrap');
  const raw = record.data[field.key];
  const display = el('span', 'enc-value');

  const reveal = el('button', 'btn btn-ghost btn-sm');
  reveal.textContent = isEncrypted(raw) ? '👁 Reveal' : '＋ Set';

  const render = () => {
    display.textContent = isEncrypted(raw) ? '•••••••• (encrypted)' : '(empty)';
  };
  render();

  reveal.addEventListener('click', async () => {
    if (!vault.isUnlocked) {
      toast.error('Unlock the vault to view or edit encrypted fields.');
      return;
    }
    let current = '';
    if (isEncrypted(record.data[field.key])) {
      try {
        current = await vault.decryptValue(record.data[field.key]);
      } catch (e) {
        toast.error(e.message);
        return;
      }
    }
    const modal = openModal({
      title: `${field.label || field.key} (encrypted)`,
      body: `<label>Value</label><input id="enc-input" type="text" value="${escapeAttr(current)}" />`,
      actions: [
        { label: 'Cancel', value: null },
        {
          label: 'Save encrypted',
          variant: 'primary',
          onClick: async ({ bodyEl }) => {
            const val = bodyEl.querySelector('#enc-input').value;
            const enc = await vault.encryptValue(val);
            record.data[field.key] = enc;
            await commit(record, field.key, enc, onUpdate, true);
            render();
            toast.success('Encrypted value saved');
          },
        },
      ],
    });
    void modal;
  });

  container.append(display, reveal);
  return container;
}

function magicButton(field, record, schema, input, onUpdate) {
  const btn = el('button', 'magic-btn');
  btn.type = 'button';
  btn.innerHTML = '✨';
  btn.title = 'Generate with AI';
  btn.addEventListener('click', async () => {
    btn.classList.add('busy');
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      const text = await aiClient.fillField(field, record.data, schema);
      input.value = text;
      await commit(record, field.key, text, onUpdate);
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

async function commit(record, key, value, onUpdate, alreadySet = false) {
  if (!alreadySet) record.data[key] = value;
  try {
    await onUpdate(record.id, { [key]: value });
  } catch (e) {
    toast.error(`Save failed: ${e.message}`);
  }
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
