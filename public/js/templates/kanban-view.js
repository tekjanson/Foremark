// public/js/templates/kanban-view.js
// Workflow stage & status board with drag-and-drop between columns.

import { statusField, primaryField } from './registry.js';
import { toast } from '../ui/toast.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/**
 * @param {object} ctx
 * @param {object} ctx.schema
 * @param {Array}  ctx.records
 * @param {(id,data)=>Promise} ctx.onUpdate
 */
export function renderKanbanView({ schema, records, onUpdate }) {
  const sField = statusField(schema);
  const board = el('div', 'kanban');

  if (!sField) {
    const note = el('div', 'empty-state');
    note.innerHTML =
      '<div><div class="big">▦</div>This template has no <b>status</b> field, so the Kanban board is unavailable.</div>';
    board.appendChild(note);
    return board;
  }

  const pField = primaryField(schema);
  const columns = sField.options || [];

  for (const status of columns) {
    const col = el('div', 'kanban-col');
    col.dataset.status = status;

    const head = el('div', 'kanban-col-head');
    head.appendChild(el('span', null, status));
    const grouped = records.filter((r) => (r.data[sField.key] || columns[0]) === status);
    head.appendChild(el('span', 'count', String(grouped.length)));
    col.appendChild(head);

    for (const record of grouped) {
      col.appendChild(makeCard(record, pField, schema, sField));
    }

    // Drag & drop targets
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      const card = board.querySelector(`.kanban-card[data-id="${id}"]`);
      const record = records.find((r) => r.id === id);
      if (!record || !card) return;
      if (record.data[sField.key] === status) return;
      record.data[sField.key] = status;
      col.appendChild(card);
      updateCounts(board, records, sField, columns);
      try {
        await onUpdate(id, { [sField.key]: status });
        toast.success(`Moved to "${status}"`);
      } catch (err) {
        toast.error(err.message);
      }
    });

    board.appendChild(col);
  }

  return board;
}

function makeCard(record, pField, schema, sField) {
  const card = el('div', 'kanban-card');
  card.dataset.id = record.id;
  card.draggable = true;

  const titleVal = record.data[pField.key] || '(untitled)';
  card.appendChild(el('h5', null, titleVal));

  // Show up to two secondary fields as meta.
  const meta = schema.fields
    .filter((f) => f.key !== pField.key && f.key !== sField.key && f.type !== 'encrypted')
    .slice(0, 2)
    .map((f) => record.data[f.key])
    .filter(Boolean)
    .join(' · ');
  if (meta) card.appendChild(el('div', 'meta', meta));

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', record.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  return card;
}

function updateCounts(board, records, sField, columns) {
  for (const status of columns) {
    const col = board.querySelector(`.kanban-col[data-status="${CSS.escape(status)}"]`);
    if (!col) continue;
    const count = col.querySelectorAll('.kanban-card').length;
    col.querySelector('.count').textContent = String(count);
  }
}
