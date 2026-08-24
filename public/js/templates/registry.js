// public/js/templates/registry.js
// Schema registry & built-in template definitions.
//
// A template is:
//   { id, title, icon, description, fields: [...], views: [...] }
//
// Field descriptor:
//   { key, label, type, options?, aiPrompt?, primary? }
// type: text | textarea | select | number | date | status | encrypted | file

export const FIELD_TYPES = [
  'text',
  'textarea',
  'select',
  'number',
  'date',
  'status',
  'encrypted',
  'file',
];

// Built-in built-in ids that were part of earlier (construction-focused)
// releases and should be removed on boot so the app stays generic.
export const RETIRED_BUILTIN_IDS = ['construction-rfi', 'daily-log'];

export const BUILTIN_TEMPLATES = [
  {
    id: 'task-tracker',
    title: 'Task & Project Tracker',
    icon: '✅',
    description: 'Plan work, assign owners, and track progress on a board.',
    views: ['table', 'kanban', 'cards', 'form'],
    fields: [
      {
        key: 'title',
        label: 'Title',
        type: 'text',
        primary: true,
        aiPrompt: 'Write a short, actionable task title from: {{context}}',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        aiPrompt: 'Write a concise task description from: {{context}}',
      },
      { key: 'assignee', label: 'Assignee', type: 'text' },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        options: ['low', 'medium', 'high', 'urgent'],
      },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        options: ['backlog', 'todo', 'in-progress', 'done'],
      },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'tags', label: 'Tags', type: 'text' },
    ],
  },
  {
    id: 'architecture',
    title: 'System Architecture Map',
    icon: '🗺️',
    description:
      'Diagram services, data stores, and how they connect — map your own systems.',
    views: ['diagram', 'table', 'cards', 'form'],
    fields: [
      { key: 'name', label: 'Component', type: 'text', primary: true },
      {
        key: 'layer',
        label: 'Layer',
        type: 'select',
        options: ['client', 'edge', 'application', 'data', 'external'],
      },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: [
          'frontend',
          'api',
          'service',
          'database',
          'cache',
          'queue',
          'storage',
          'auth',
          'external',
        ],
      },
      { key: 'tech', label: 'Technology', type: 'text' },
      {
        key: 'connectsTo',
        label: 'Connects To',
        type: 'text',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        aiPrompt:
          'Briefly describe the role of this system component: {{context}}',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        options: ['planned', 'active', 'deprecated'],
      },
    ],
  },
  {
    id: 'contacts',
    title: 'Contacts & CRM',
    icon: '👤',
    description: 'A lightweight address book and relationship pipeline.',
    views: ['table', 'cards', 'kanban', 'form'],
    fields: [
      { key: 'name', label: 'Name', type: 'text', primary: true },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'company', label: 'Company', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      {
        key: 'status',
        label: 'Stage',
        type: 'status',
        options: ['lead', 'prospect', 'active', 'inactive'],
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'textarea',
        aiPrompt: 'Draft a brief relationship note from: {{context}}',
      },
    ],
  },
  {
    id: 'issue-tracker',
    title: 'Issues & Tickets',
    icon: '🎫',
    description: 'Track requests, bugs, and questions through to resolution.',
    views: ['table', 'kanban', 'form', 'cards'],
    fields: [
      {
        key: 'subject',
        label: 'Subject',
        type: 'text',
        primary: true,
        aiPrompt: 'Write a concise issue title from: {{context}}',
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: ['bug', 'feature', 'question', 'task'],
      },
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        aiPrompt: 'Draft a clear issue description from: {{context}}',
      },
      { key: 'assignee', label: 'Assignee', type: 'text' },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        options: ['low', 'medium', 'high', 'critical'],
      },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        options: ['open', 'in-progress', 'blocked', 'resolved', 'closed'],
      },
    ],
  },
  {
    id: 'meeting-notes',
    title: 'Meeting Notes',
    icon: '🗒️',
    description: 'Capture agendas, decisions, and action items.',
    views: ['table', 'cards', 'form'],
    fields: [
      { key: 'title', label: 'Title', type: 'text', primary: true },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'attendees', label: 'Attendees', type: 'text' },
      { key: 'agenda', label: 'Agenda', type: 'textarea' },
      {
        key: 'decisions',
        label: 'Decisions',
        type: 'textarea',
        aiPrompt: 'Summarize the key decisions from these notes: {{context}}',
      },
      {
        key: 'actionItems',
        label: 'Action Items',
        type: 'textarea',
        aiPrompt: 'Extract a bulleted list of action items from: {{context}}',
      },
    ],
  },
  {
    id: 'expense-log',
    title: 'Expense Log',
    icon: '💳',
    description: 'Track spending, categories, and reimbursement status.',
    views: ['table', 'cards', 'form'],
    fields: [
      { key: 'merchant', label: 'Merchant', type: 'text', primary: true },
      { key: 'date', label: 'Date', type: 'date' },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: ['travel', 'meals', 'software', 'office', 'hardware', 'other'],
      },
      { key: 'amount', label: 'Amount', type: 'number' },
      {
        key: 'method',
        label: 'Method',
        type: 'select',
        options: ['card', 'cash', 'transfer', 'invoice'],
      },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        options: ['pending', 'submitted', 'reimbursed'],
      },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory & Assets',
    icon: '📦',
    description: 'Track items, quantities, locations, and value.',
    views: ['table', 'cards', 'form'],
    fields: [
      { key: 'item', label: 'Item', type: 'text', primary: true },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: ['electronics', 'furniture', 'supplies', 'tools', 'other'],
      },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'value', label: 'Unit Value', type: 'number' },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        options: ['in-stock', 'low', 'ordered', 'retired'],
      },
    ],
  },
  {
    id: 'secrets-vault',
    title: 'Encrypted Secrets Vault',
    icon: '🔐',
    description: 'Store credentials with client-side field-level encryption.',
    views: ['table', 'cards', 'form'],
    fields: [
      { key: 'service', label: 'Service', type: 'text', primary: true },
      { key: 'username', label: 'Username', type: 'text' },
      { key: 'secret', label: 'Secret', type: 'encrypted' },
      { key: 'url', label: 'URL', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    id: 'custom-grid',
    title: 'Flexible Grid',
    icon: '▦',
    description: 'A blank grid — define your own columns.',
    views: ['table', 'cards'],
    fields: [
      { key: 'colA', label: 'Column A', type: 'text', primary: true },
      { key: 'colB', label: 'Column B', type: 'text' },
      { key: 'colC', label: 'Column C', type: 'text' },
    ],
  },
];

/** Validate a template schema. Returns { valid, errors[] }. */
export function validateTemplate(schema) {
  const errors = [];
  if (!schema || typeof schema !== 'object') {
    return { valid: false, errors: ['Schema must be an object.'] };
  }
  if (!schema.title || typeof schema.title !== 'string') {
    errors.push('Template requires a non-empty "title".');
  }
  if (!Array.isArray(schema.fields) || schema.fields.length === 0) {
    errors.push('Template requires at least one field.');
  } else {
    const seen = new Set();
    schema.fields.forEach((f, i) => {
      if (!f.key) errors.push(`Field #${i + 1} is missing a "key".`);
      else if (seen.has(f.key)) errors.push(`Duplicate field key "${f.key}".`);
      else seen.add(f.key);
      if (f.type && !FIELD_TYPES.includes(f.type)) {
        errors.push(`Field "${f.key}" has invalid type "${f.type}".`);
      }
      if (f.type === 'select' || f.type === 'status') {
        if (!Array.isArray(f.options) || f.options.length === 0) {
          errors.push(`Field "${f.key}" (${f.type}) requires "options".`);
        }
      }
    });
  }
  if (!Array.isArray(schema.views) || schema.views.length === 0) {
    errors.push('Template requires at least one view.');
  }
  return { valid: errors.length === 0, errors };
}

/** Return the field marked primary, or the first field. */
export function primaryField(schema) {
  return schema.fields.find((f) => f.primary) || schema.fields[0];
}

/** Get the status field (type "status"), if any. */
export function statusField(schema) {
  return schema.fields.find((f) => f.type === 'status');
}

/** Deep clone a built-in template for safe local editing. */
export function cloneTemplate(id) {
  const t = BUILTIN_TEMPLATES.find((x) => x.id === id);
  return t ? structuredClone(t) : null;
}
