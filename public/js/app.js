// public/js/app.js
// Core SPA router & state manager for Foremark.

import { api } from './storage/api-client.js';
import { localStore } from './storage/local-store.js';
import { vault } from './crypto/vault.js';
import { toast } from './ui/toast.js';
import { openModal, confirmModal } from './ui/modal.js';
import { initTheme, cycleTheme, themeLabel } from './ui/theme.js';
import {
  BUILTIN_TEMPLATES,
  RETIRED_BUILTIN_IDS,
  validateTemplate,
  primaryField,
  FIELD_TYPES,
  cloneTemplate,
} from './templates/registry.js';
import { renderTableView } from './templates/table-view.js';
import { renderFormView } from './templates/form-view.js';
import { renderKanbanView } from './templates/kanban-view.js';
import { renderDiagramView } from './templates/diagram-view.js';
import { aiClient, PROVIDER_MODELS } from './ai/ai-client.js';
import { generateRecords, makeSecret } from './data/sample-data.js';

const state = {
  templates: [], // [{id, schema}]
  activeTemplateId: null,
  activeView: 'table',
  records: [],
  search: '',
  selectedRecordId: null,
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// ── Bootstrap ─────────────────────────────────────────────────────────────

async function boot() {
  initTheme();
  await vault.load();
  vault.onChange(renderVaultIndicator);

  await ensureBuiltinTemplates();
  await loadTemplates();

  bindGlobalControls();
  renderSidebar();
  renderVaultIndicator();

  // Restore last active template.
  const last = localStore.getSettings().lastTemplate;
  const initial =
    state.templates.find((t) => t.id === last)?.id ||
    state.templates[0]?.id ||
    null;
  if (initial) await selectTemplate(initial);
  else renderEmptyWorkspace();
}

/** Seed built-in templates and retire construction-era ones (idempotent). */
async function ensureBuiltinTemplates() {
  const { templates } = await api.listTemplates();
  const existing = new Set(templates.map((t) => t.id));

  // Remove templates from earlier construction-focused releases.
  for (const id of RETIRED_BUILTIN_IDS) {
    if (existing.has(id)) {
      await api.clearRecords(id).catch(() => {});
      await api.deleteTemplate(id).catch(() => {});
      existing.delete(id);
    }
  }

  // Keep built-ins canonical: upsert each to its current definition. Records
  // and user-created templates are untouched. (To customize a built-in,
  // clone it via "New Template" so your copy isn't refreshed on reload.)
  for (const t of BUILTIN_TEMPLATES) {
    await api.saveTemplate({ id: t.id, ...t });
  }
}

async function loadTemplates() {
  const { templates } = await api.listTemplates();
  state.templates = templates.map((t) => ({ id: t.id, ...t.schema }));
}

// ── Sidebar ────────────────────────────────────────────────────────────────

function openSidebar() {
  document.querySelector('.sidebar')?.classList.add('open');
  $('#sidebar-backdrop')?.classList.add('show');
}

function closeSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  $('#sidebar-backdrop')?.classList.remove('show');
}

function renderSidebar() {
  const list = $('#template-list');
  list.innerHTML = '';
  for (const t of state.templates) {
    const btn = el('button', 'nav-item');
    if (t.id === state.activeTemplateId) btn.classList.add('active');
    btn.innerHTML = `<span class="nav-icon">${t.icon || '▦'}</span><span class="grow">${escapeHtml(
      t.title
    )}</span>`;
    btn.addEventListener('click', () => selectTemplate(t.id));
    list.appendChild(btn);
  }
}

// ── Template selection & workspace render ───────────────────────────────────

async function selectTemplate(id) {
  state.activeTemplateId = id;
  const schema = currentSchema();
  state.activeView = schema.views?.[0] || 'table';
  state.search = '';
  localStore.updateSettings({ lastTemplate: id });
  await loadRecords();
  renderSidebar();
  renderWorkspace();
  closeSidebar();
}

function currentSchema() {
  return state.templates.find((t) => t.id === state.activeTemplateId);
}

async function loadRecords() {
  try {
    const { records } = await api.listRecords(
      state.activeTemplateId,
      state.search || undefined
    );
    state.records = records;
    localStore.cacheRecords(state.activeTemplateId, records);
  } catch (e) {
    const cached = localStore.getCachedRecords(state.activeTemplateId);
    if (cached) {
      state.records = cached;
      toast.info('Offline — showing cached records.');
    } else {
      state.records = [];
      toast.error(`Failed to load records: ${e.message}`);
    }
  }

  // Demo mode: auto-populate empty templates with sample data.
  if (
    isDemoMode() &&
    !state.search &&
    state.records.length === 0 &&
    state.activeTemplateId
  ) {
    await generateSampleData(currentSchema(), randInt(8, 14), { silent: true });
  }
}

function renderWorkspace() {
  const schema = currentSchema();
  if (!schema) return renderEmptyWorkspace();

  $('#workspace-title').textContent = `${schema.icon || ''} ${schema.title}`.trim();

  // View tabs
  const tabs = $('#view-tabs');
  tabs.innerHTML = '';
  for (const v of schema.views || ['table']) {
    const tab = el('button', 'view-tab', capitalize(v));
    if (v === state.activeView) tab.classList.add('active');
    tab.addEventListener('click', () => {
      state.activeView = v;
      renderWorkspace();
    });
    tabs.appendChild(tab);
  }

  // Body
  const body = $('#workspace-body');
  body.innerHTML = '';

  // Toolbar
  body.appendChild(renderToolbar(schema));

  const onUpdate = async (recordId, data) => {
    const { record } = await api.updateRecord(recordId, data);
    const idx = state.records.findIndex((r) => r.id === recordId);
    if (idx >= 0) state.records[idx] = record;
    return record;
  };
  const onDelete = async (recordId) => {
    await api.deleteRecord(recordId);
    state.records = state.records.filter((r) => r.id !== recordId);
  };
  const onEdit = (record) => openRecordForm(schema, record, onUpdate);

  const viewCtx = { schema, records: state.records, onUpdate, onDelete, onEdit };

  let view;
  switch (state.activeView) {
    case 'form':
      view = renderFormPager(schema, onUpdate);
      break;
    case 'kanban':
      view = renderKanbanView(viewCtx);
      break;
    case 'diagram':
      view = renderDiagramView(viewCtx);
      break;
    case 'cards':
      view = renderCardsView(viewCtx);
      break;
    case 'table':
    default:
      view = renderTableView(viewCtx);
  }
  body.appendChild(view);

  if (
    state.records.length === 0 &&
    state.activeView !== 'form' &&
    state.activeView !== 'diagram'
  ) {
    const empty = el('div', 'empty-state');
    empty.style.marginTop = 'var(--space-6)';
    empty.innerHTML =
      '<div><div class="big">📭</div>No records yet. Click <b>+ New Record</b> or <b>Parse &amp; Ingest</b>.</div>';
    body.appendChild(empty);
  }
}

function renderToolbar(schema) {
  const bar = el('div', 'toolbar');

  const newBtn = el('button', 'btn btn-primary', '＋ New Record');
  newBtn.addEventListener('click', () => createRecord(schema));

  const ingestBtn = el('button', 'btn', '✨ Parse & Ingest');
  ingestBtn.addEventListener('click', () => openIngestModal(schema));

  const sampleBtn = el('button', 'btn', '🎲 Sample Data');
  sampleBtn.title = 'Generate randomized demo records';
  sampleBtn.addEventListener('click', () =>
    generateSampleData(schema, randInt(8, 14))
  );

  const search = el('input', 'search');
  search.placeholder = 'Search records…';
  search.value = state.search;
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      state.search = search.value.trim();
      await loadRecords();
      renderWorkspace();
    }, 250);
  });

  const exportBtn = el('button', 'btn', '⬇ Export');
  exportBtn.addEventListener('click', () => openExportMenu(schema));

  const clearBtn = el('button', 'btn btn-ghost', '🧹 Clear');
  clearBtn.title = 'Delete all records in this template';
  clearBtn.addEventListener('click', () => clearRecords(schema));

  const editBtn = el('button', 'btn btn-ghost', '⚙ Edit Schema');
  editBtn.addEventListener('click', () => openSchemaEditor(schema));

  bar.append(
    newBtn,
    ingestBtn,
    sampleBtn,
    search,
    el('div', 'grow'),
    exportBtn,
    clearBtn,
    editBtn
  );
  return bar;
}

// ── Demo Mode & sample data ─────────────────────────────────────────────────

function isDemoMode() {
  return Boolean(localStore.getSettings().demoMode);
}

function setDemoMode(on) {
  localStore.updateSettings({ demoMode: Boolean(on) });
  updateDemoButton();
}

function updateDemoButton() {
  const btn = $('#demo-btn');
  if (!btn) return;
  const on = isDemoMode();
  btn.classList.toggle('active', on);
  btn.textContent = on ? '🎲 Demo: On' : '🎲 Demo: Off';
}

/**
 * Generate and persist randomized sample records for a template.
 * Encrypted fields are filled with a fake secret only when the vault is
 * unlocked; otherwise they are left empty.
 */
async function generateSampleData(schema, count = 10, { silent = false } = {}) {
  const rows = generateRecords(schema, count);

  // Optionally encrypt fake secrets for encrypted fields.
  const encFields = schema.fields.filter((f) => f.type === 'encrypted');
  if (encFields.length && vault.isUnlocked) {
    for (const row of rows) {
      for (const f of encFields) {
        row[f.key] = await vault.encryptValue(makeSecret());
      }
    }
  }

  try {
    const { records } = await api.bulkCreateRecords(schema.id, rows, true);
    state.records = [...records, ...state.records];
    if (!silent) {
      renderWorkspace();
      toast.success(`Generated ${records.length} sample records`);
    }
  } catch (e) {
    if (!silent) toast.error(`Could not generate data: ${e.message}`);
  }
}

async function clearRecords(schema) {
  const count = state.records.length;
  if (count === 0) return toast.info('No records to clear.');
  const ok = await confirmModal(
    `Delete all ${count} records in "${schema.title}"? This cannot be undone.`,
    { danger: true, title: 'Clear records' }
  );
  if (!ok) return;
  try {
    await api.clearRecords(schema.id);
    state.records = [];
    renderWorkspace();
    toast.success('All records cleared');
  } catch (e) {
    toast.error(`Clear failed: ${e.message}`);
  }
}

// ── Cards view (inline) ─────────────────────────────────────────────────────

function renderCardsView({ schema, records, onUpdate, onDelete }) {
  const grid = el('div', 'cards-grid');
  const pField = primaryField(schema);
  for (const record of records) {
    const card = el('div', 'record-card');
    card.appendChild(el('h4', null, record.data[pField.key] || '(untitled)'));
    for (const f of schema.fields) {
      if (f.key === pField.key) continue;
      const row = el('div', 'field-row');
      row.appendChild(el('span', 'k', f.label || f.key));
      const v = f.type === 'encrypted' ? '🔒 encrypted' : record.data[f.key] ?? '—';
      row.appendChild(el('span', 'v', String(v)));
      card.appendChild(row);
    }
    const actions = el('div', 'toolbar');
    actions.style.marginTop = 'var(--space-3)';
    const edit = el('button', 'btn btn-sm', 'Edit');
    edit.addEventListener('click', () => openRecordForm(schema, record, onUpdate));
    const del = el('button', 'btn btn-sm btn-ghost', '🗑');
    del.addEventListener('click', async () => {
      if (await confirmModal('Delete this record?', { danger: true })) {
        await onDelete(record.id);
        renderWorkspace();
      }
    });
    actions.append(edit, del);
    card.appendChild(actions);
    grid.appendChild(card);
  }
  return grid;
}

// ── Form pager (form view over all records) ─────────────────────────────────

function renderFormPager(schema, onUpdate) {
  const wrap = el('div');
  if (state.records.length === 0) {
    const empty = el('div', 'empty-state');
    empty.innerHTML =
      '<div><div class="big">📝</div>No records. Create one to edit it as a form.</div>';
    wrap.appendChild(empty);
    return wrap;
  }
  let idx = Math.max(
    0,
    state.records.findIndex((r) => r.id === state.selectedRecordId)
  );

  const nav = el('div', 'toolbar');
  const prev = el('button', 'btn btn-sm', '‹ Prev');
  const next = el('button', 'btn btn-sm', 'Next ›');
  const label = el('span', 'muted');
  nav.append(prev, label, next);
  wrap.appendChild(nav);

  const host = el('div');
  wrap.appendChild(host);

  const draw = () => {
    const record = state.records[idx];
    state.selectedRecordId = record.id;
    label.textContent = `Record ${idx + 1} of ${state.records.length}`;
    host.innerHTML = '';
    host.appendChild(renderFormView({ schema, record, onUpdate }));
  };
  prev.addEventListener('click', () => {
    idx = (idx - 1 + state.records.length) % state.records.length;
    draw();
  });
  next.addEventListener('click', () => {
    idx = (idx + 1) % state.records.length;
    draw();
  });
  draw();
  return wrap;
}

function openRecordForm(schema, record, onUpdate) {
  const host = el('div');
  const m = openModal({
    title: `Edit ${schema.title}`,
    wide: true,
    body: host,
    actions: [{ label: 'Close', variant: 'primary' }],
  });
  host.appendChild(
    renderFormView({
      schema,
      record,
      onUpdate: async (id, data) => {
        const r = await onUpdate(id, data);
        return r;
      },
    })
  );
  m.promise.then(() => renderWorkspace());
}

// ── Record creation ─────────────────────────────────────────────────────────

async function createRecord(schema) {
  const data = {};
  for (const f of schema.fields) {
    if (f.type === 'status') data[f.key] = f.options?.[0] ?? '';
  }
  const { record } = await api.createRecord(schema.id, data);
  state.records.unshift(record);
  renderWorkspace();
  toast.success('Record created');
}

// ── Parse & Ingest (Phase 5) ────────────────────────────────────────────────

function openIngestModal(schema) {
  const host = el('div');
  host.innerHTML = `
    <p class="muted">Paste unstructured notes, logs, or text below. AI will map it into
    <b>${escapeHtml(schema.title)}</b> records.</p>
    <label>Raw text</label>
    <textarea id="ingest-text" style="min-height:160px" placeholder="Paste field notes, an email, a log dump…"></textarea>
    <div id="ingest-preview"></div>
  `;
  const modal = openModal({
    title: '✨ Parse & Ingest',
    wide: true,
    body: host,
    actions: [
      { label: 'Cancel', value: null },
      {
        label: 'Extract',
        variant: 'primary',
        keep: true,
        onClick: async ({ bodyEl, btn }) => {
          const text = bodyEl.querySelector('#ingest-text').value.trim();
          if (!text) return toast.error('Paste some text first.');
          const original = btn.textContent;
          btn.innerHTML = '<span class="spinner"></span> Extracting…';
          btn.disabled = true;
          try {
            const extracted = await aiClient.extract(text, schema);
            const rows = Array.isArray(extracted) ? extracted : [extracted];
            renderIngestPreview(bodyEl.querySelector('#ingest-preview'), schema, rows, modal);
          } catch (e) {
            toast.error(`Extraction failed: ${e.message}`);
          } finally {
            btn.innerHTML = original;
            btn.disabled = false;
          }
        },
      },
    ],
  });
}

function renderIngestPreview(host, schema, rows, modal) {
  host.innerHTML = '';
  const h = el('h4', null, `Preview — ${rows.length} record(s)`);
  host.appendChild(h);

  const wrap = el('div', 'data-table-wrap');
  const table = el('table', 'data-table');
  const thead = el('thead');
  const hr = el('tr');
  for (const f of schema.fields) hr.appendChild(el('th', null, f.label || f.key));
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = el('tbody');
  for (const row of rows) {
    const tr = el('tr');
    for (const f of schema.fields) {
      tr.appendChild(el('td', null, String(row[f.key] ?? '')));
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  host.appendChild(wrap);

  const bar = el('div', 'toolbar');
  bar.style.marginTop = 'var(--space-3)';
  const importBtn = el('button', 'btn btn-primary', `Import ${rows.length} record(s)`);
  importBtn.addEventListener('click', async () => {
    importBtn.disabled = true;
    let ok = 0;
    for (const row of rows) {
      try {
        const clean = {};
        for (const f of schema.fields) {
          if (f.type !== 'encrypted' && row[f.key] != null) clean[f.key] = row[f.key];
        }
        const { record } = await api.createRecord(schema.id, clean);
        state.records.unshift(record);
        ok++;
      } catch {
        /* skip bad row */
      }
    }
    toast.success(`Imported ${ok} record(s)`);
    modal.close();
    renderWorkspace();
  });
  bar.appendChild(importBtn);
  host.appendChild(bar);
}

// ── Export menu ──────────────────────────────────────────────────────────────

function openExportMenu(schema) {
  openModal({
    title: 'Export data',
    body: `
      <p class="muted">Export <b>${escapeHtml(schema.title)}</b> or the whole workspace.</p>
      <div class="toolbar">
        <a class="btn" href="/api/export/csv?templateId=${encodeURIComponent(schema.id)}">⬇ CSV</a>
        <a class="btn" href="/api/export/html?templateId=${encodeURIComponent(schema.id)}" target="_blank">🖨 Printable HTML</a>
        <a class="btn" href="/api/export/json">🗄 Full JSON backup</a>
      </div>
    `,
    actions: [{ label: 'Close', variant: 'primary' }],
  });
}

// ── Schema editor ────────────────────────────────────────────────────────────

function openSchemaEditor(schema) {
  const working = structuredClone(schema);
  const host = el('div');
  const list = el('div', 'field-list');

  const drawFields = () => {
    list.innerHTML = '';
    working.fields.forEach((f, i) => {
      const row = el('div', 'field-def-row');
      const key = el('input');
      key.value = f.key;
      key.placeholder = 'key';
      key.addEventListener('input', () => (f.key = key.value));
      const lbl = el('input');
      lbl.value = f.label || '';
      lbl.placeholder = 'Label';
      lbl.addEventListener('input', () => (f.label = lbl.value));
      const type = el('select');
      for (const t of FIELD_TYPES) {
        const o = el('option', null, t);
        o.value = t;
        if (t === f.type) o.selected = true;
        type.appendChild(o);
      }
      type.addEventListener('change', () => {
        f.type = type.value;
        if ((f.type === 'select' || f.type === 'status') && !f.options)
          f.options = ['option-1'];
      });
      const del = el('button', 'btn btn-ghost btn-sm', '🗑');
      del.addEventListener('click', () => {
        working.fields.splice(i, 1);
        drawFields();
      });
      row.append(key, lbl, type, del);
      list.appendChild(row);
    });
  };

  const titleInput = el('input');
  titleInput.value = working.title;
  titleInput.addEventListener('input', () => (working.title = titleInput.value));

  host.appendChild(el('label', null, 'Template title'));
  host.appendChild(titleInput);
  host.appendChild(el('label', null, 'Fields'));
  host.appendChild(list);
  const addBtn = el('button', 'btn btn-sm', '＋ Add field');
  addBtn.style.marginTop = 'var(--space-2)';
  addBtn.addEventListener('click', () => {
    working.fields.push({ key: `field${working.fields.length + 1}`, label: 'New Field', type: 'text' });
    drawFields();
  });
  host.appendChild(addBtn);
  drawFields();

  openModal({
    title: 'Edit schema',
    wide: true,
    body: host,
    actions: [
      { label: 'Cancel', value: null },
      {
        label: 'Save schema',
        variant: 'primary',
        keep: true,
        onClick: async ({ close }) => {
          const { valid, errors } = validateTemplate(working);
          if (!valid) return toast.error(errors[0]);
          await api.saveTemplate({ id: working.id, ...working });
          await loadTemplates();
          renderSidebar();
          renderWorkspace();
          toast.success('Schema saved');
          close();
        },
      },
    ],
  });
}

// ── New template ─────────────────────────────────────────────────────────────

function openNewTemplate() {
  const host = el('div');
  host.innerHTML = `
    <label>Start from a built-in template</label>
    <select id="tmpl-base"></select>
    <label style="margin-top:var(--space-3)">New template title</label>
    <input id="tmpl-title" placeholder="e.g. Punch List" />
  `;
  const sel = host.querySelector('#tmpl-base');
  sel.appendChild(el('option', null, 'Blank grid'));
  sel.lastChild.value = 'custom-grid';
  for (const t of BUILTIN_TEMPLATES) {
    const o = el('option', null, t.title);
    o.value = t.id;
    sel.appendChild(o);
  }
  openModal({
    title: 'New template',
    body: host,
    actions: [
      { label: 'Cancel', value: null },
      {
        label: 'Create',
        variant: 'primary',
        keep: true,
        onClick: async ({ close }) => {
          const base = cloneTemplate(sel.value) || cloneTemplate('custom-grid');
          const title = host.querySelector('#tmpl-title').value.trim() || 'Untitled';
          base.id = `${slugify(title)}-${Date.now().toString(36)}`;
          base.title = title;
          await api.saveTemplate({ id: base.id, ...base });
          await loadTemplates();
          renderSidebar();
          await selectTemplate(base.id);
          toast.success('Template created');
          close();
        },
      },
    ],
  });
}

// ── Vault UI ─────────────────────────────────────────────────────────────────

function renderVaultIndicator() {
  const ind = $('#vault-indicator');
  if (!ind) return;
  const unlocked = vault.isUnlocked;
  ind.className = `vault-indicator ${unlocked ? 'unlocked' : 'locked'}`;
  ind.textContent = unlocked ? '🔓 Vault unlocked' : '🔒 Vault locked';
}

function openVaultModal() {
  const initialized = vault.isInitialized;
  const unlocked = vault.isUnlocked;

  if (unlocked) {
    return openModal({
      title: 'Vault',
      body: '<p>Your vault is unlocked. Encrypted fields are readable this session.</p>',
      actions: [
        {
          label: 'Change passphrase',
          keep: true,
          onClick: ({ close }) => {
            close();
            openChangePassphrase();
          },
        },
        {
          label: 'Lock vault',
          variant: 'danger',
          onClick: () => {
            vault.lock();
            toast.info('Vault locked');
            renderWorkspace();
          },
        },
        { label: 'Close', variant: 'primary' },
      ],
    });
  }

  const host = el('div');
  host.innerHTML = initialized
    ? `<label>Passphrase</label><input id="vp" type="password" placeholder="Enter your vault passphrase" />`
    : `<p class="muted">Set a master passphrase to enable field-level encryption. This never leaves your browser.</p>
       <label>New passphrase</label><input id="vp" type="password" placeholder="Choose a strong passphrase" />`;

  openModal({
    title: initialized ? 'Unlock vault' : 'Set up vault',
    body: host,
    actions: [
      { label: 'Cancel', value: null },
      {
        label: initialized ? 'Unlock' : 'Create vault',
        variant: 'primary',
        keep: true,
        onClick: async ({ close }) => {
          const pass = host.querySelector('#vp').value;
          try {
            if (initialized) await vault.unlock(pass);
            else await vault.initialize(pass);
            toast.success(initialized ? 'Vault unlocked' : 'Vault created & unlocked');
            renderWorkspace();
            close();
          } catch (e) {
            toast.error(e.message);
          }
        },
      },
    ],
  });
}

function openChangePassphrase() {
  const host = el('div');
  host.innerHTML = `
    <label>Current passphrase</label><input id="cur" type="password" />
    <label style="margin-top:var(--space-3)">New passphrase</label><input id="next" type="password" />
  `;
  openModal({
    title: 'Change passphrase',
    body: host,
    actions: [
      { label: 'Cancel', value: null },
      {
        label: 'Update',
        variant: 'primary',
        keep: true,
        onClick: async ({ close }) => {
          try {
            await vault.changePassphrase(
              host.querySelector('#cur').value,
              host.querySelector('#next').value
            );
            toast.success('Passphrase updated');
            close();
          } catch (e) {
            toast.error(e.message);
          }
        },
      },
    ],
  });
}

// ── AI settings (Phase 5) ────────────────────────────────────────────────────

function openSettings() {
  const s = aiClient.getSettings();
  const host = el('div');
  host.innerHTML = `
    <label>Default AI provider</label>
    <select id="provider"></select>
    <label style="margin-top:var(--space-3)">Model</label>
    <select id="model"></select>
    <label style="margin-top:var(--space-3)">API key <span class="muted">(stored only in this browser)</span></label>
    <input id="apikey" type="password" placeholder="sk-… / anthropic / gemini key" />
    <label style="margin-top:var(--space-3)">Ollama base URL</label>
    <input id="ollama" type="text" placeholder="http://localhost:11434" />
  `;
  const providerSel = host.querySelector('#provider');
  const modelSel = host.querySelector('#model');
  const keyInput = host.querySelector('#apikey');
  const ollamaInput = host.querySelector('#ollama');

  for (const p of Object.keys(PROVIDER_MODELS)) {
    const o = el('option', null, p);
    o.value = p;
    if (p === (s.provider || 'openai')) o.selected = true;
    providerSel.appendChild(o);
  }
  const fillModels = () => {
    modelSel.innerHTML = '';
    for (const m of PROVIDER_MODELS[providerSel.value]) {
      const o = el('option', null, m);
      o.value = m;
      if (m === s.models?.[providerSel.value]) o.selected = true;
      modelSel.appendChild(o);
    }
    keyInput.value = s.keys?.[providerSel.value] || '';
  };
  providerSel.addEventListener('change', fillModels);
  fillModels();
  ollamaInput.value = s.ollamaBaseUrl || '';

  openModal({
    title: '⚙ AI Settings',
    body: host,
    actions: [
      { label: 'Cancel', value: null },
      {
        label: 'Save',
        variant: 'primary',
        onClick: () => {
          const provider = providerSel.value;
          const models = { ...(s.models || {}), [provider]: modelSel.value };
          const keys = { ...(s.keys || {}) };
          if (keyInput.value) keys[provider] = keyInput.value;
          aiClient.saveSettings({
            provider,
            models,
            keys,
            ollamaBaseUrl: ollamaInput.value || undefined,
          });
          toast.success('Settings saved');
        },
      },
    ],
  });
}

// ── Global controls ──────────────────────────────────────────────────────────

function bindGlobalControls() {
  $('#new-template-btn').addEventListener('click', openNewTemplate);
  $('#vault-btn').addEventListener('click', openVaultModal);
  $('#vault-indicator').addEventListener('click', openVaultModal);
  $('#settings-btn').addEventListener('click', openSettings);
  const themeBtn = $('#theme-btn');
  themeBtn.textContent = themeLabel();
  themeBtn.addEventListener('click', () => {
    cycleTheme();
    themeBtn.textContent = themeLabel();
  });
  $('#import-btn').addEventListener('click', openImport);

  $('#menu-btn').addEventListener('click', openSidebar);
  $('#sidebar-backdrop').addEventListener('click', closeSidebar);
  const demoBtn = $('#demo-btn');
  demoBtn.addEventListener('click', async () => {
    const turningOn = !isDemoMode();
    setDemoMode(turningOn);
    if (turningOn) {
      toast.info('Demo mode on — empty templates will auto-fill with sample data.');
      if (state.activeTemplateId && state.records.length === 0) {
        await generateSampleData(currentSchema(), randInt(8, 14));
      }
    } else {
      // Turning demo off removes all demo-generated records everywhere.
      try {
        const { deleted } = await api.deleteDemoRecords();
        if (state.activeTemplateId) {
          await loadRecords();
          renderWorkspace();
        }
        toast.info(
          deleted
            ? `Demo mode off — removed ${deleted} sample records.`
            : 'Demo mode off.'
        );
      } catch (e) {
        toast.error(`Could not remove demo data: ${e.message}`);
      }
    }
  });
  updateDemoButton();
}

function openImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const res = await api.post('/api/import/json', payload);
      toast.success(
        `Imported ${res.imported.templates} templates, ${res.imported.records} records`
      );
      await loadTemplates();
      renderSidebar();
      if (state.activeTemplateId) await selectTemplate(state.activeTemplateId);
    } catch (e) {
      toast.error(`Import failed: ${e.message}`);
    }
  });
  input.click();
}

function renderEmptyWorkspace() {
  $('#workspace-title').textContent = 'Foremark';
  $('#view-tabs').innerHTML = '';
  $('#workspace-body').innerHTML =
    '<div class="empty-state"><div><div class="big">🧭</div>Select or create a template to begin.</div></div>';
}

// ── Utils ────────────────────────────────────────────────────────────────────

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'template';
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

boot().catch((e) => {
  console.error(e);
  toast.error(`Startup failed: ${e.message}`);
});
