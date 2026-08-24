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

  // ── Construction pack ──────────────────────────────────────────────────
  // Generic, industry-standard construction management concepts (no company
  // branding) — RFIs, submittals, daily reports, punch lists, safety, COs.
  {
    id: 'rfi-log',
    title: 'RFI Log',
    icon: '📐',
    description: 'Requests for Information: questions to the design team, tracked to answer.',
    views: ['table', 'kanban', 'form', 'cards'],
    fields: [
      {
        key: 'subject',
        label: 'Subject',
        type: 'text',
        primary: true,
        aiPrompt: 'Write a concise RFI subject line from: {{context}}',
      },
      { key: 'specSection', label: 'Spec Section', type: 'text' },
      {
        key: 'discipline',
        label: 'Discipline',
        type: 'select',
        options: ['architectural', 'structural', 'mechanical', 'electrical', 'plumbing', 'civil'],
      },
      {
        key: 'question',
        label: 'Question',
        type: 'textarea',
        aiPrompt: 'Draft a clear RFI question for the design team from: {{context}}',
      },
      {
        key: 'suggestion',
        label: 'Suggested Resolution',
        type: 'textarea',
        aiPrompt: 'Propose a practical suggested resolution for this RFI: {{context}}',
      },
      { key: 'ballInCourt', label: 'Ball in Court', type: 'text' },
      { key: 'dueDate', label: 'Date Required', type: 'date' },
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
        options: ['open', 'in-review', 'answered', 'closed'],
      },
    ],
  },
  {
    id: 'submittal-log',
    title: 'Submittal Log',
    icon: '📑',
    description: 'Shop drawings, product data, and samples routed for review and approval.',
    views: ['table', 'kanban', 'cards', 'form'],
    fields: [
      { key: 'number', label: 'Submittal No.', type: 'text', primary: true },
      { key: 'specSection', label: 'Spec Section', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: ['shop-drawing', 'product-data', 'sample', 'mock-up', 'o&m-manual'],
      },
      { key: 'contractor', label: 'Responsible Contractor', type: 'text' },
      { key: 'dateReceived', label: 'Date Received', type: 'date' },
      { key: 'dateReturned', label: 'Date Returned', type: 'date' },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        options: ['pending', 'in-review', 'approved', 'approved-as-noted', 'revise-resubmit', 'rejected'],
      },
    ],
  },
  {
    id: 'daily-field-report',
    title: 'Daily Field Report',
    icon: '🦺',
    description: 'Daily log of manpower, weather, activities, and site conditions.',
    views: ['table', 'cards', 'form'],
    fields: [
      { key: 'date', label: 'Date', type: 'date', primary: true },
      { key: 'weather', label: 'Weather', type: 'text' },
      { key: 'tempF', label: 'Temp (°F)', type: 'number' },
      { key: 'crewCount', label: 'Crew Count', type: 'number' },
      { key: 'trade', label: 'Trade(s) On Site', type: 'text' },
      {
        key: 'workPerformed',
        label: 'Work Performed',
        type: 'textarea',
        aiPrompt: 'Write a professional summary of work performed today from these notes: {{context}}',
      },
      {
        key: 'delays',
        label: 'Delays / Issues',
        type: 'textarea',
        aiPrompt: 'Summarize delays or issues from: {{context}}. If none, state "No delays reported."',
      },
      {
        key: 'safetyObservations',
        label: 'Safety Observations',
        type: 'textarea',
      },
    ],
  },
  {
    id: 'punch-list',
    title: 'Punch List',
    icon: '✔️',
    description: 'Closeout deficiencies tracked by location and trade through verification.',
    views: ['table', 'kanban', 'cards', 'form'],
    fields: [
      {
        key: 'item',
        label: 'Item',
        type: 'text',
        primary: true,
        aiPrompt: 'Write a short punch-list item title from: {{context}}',
      },
      { key: 'location', label: 'Location / Room', type: 'text' },
      { key: 'trade', label: 'Trade', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      {
        key: 'severity',
        label: 'Severity',
        type: 'select',
        options: ['minor', 'moderate', 'major'],
      },
      { key: 'assignedTo', label: 'Assigned To', type: 'text' },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        options: ['open', 'in-progress', 'ready-to-inspect', 'verified', 'closed'],
      },
    ],
  },
  {
    id: 'safety-observation',
    title: 'Safety Observations',
    icon: '⚠️',
    description: 'Log site hazards, near-misses, and corrective actions.',
    views: ['table', 'kanban', 'cards', 'form'],
    fields: [
      {
        key: 'observation',
        label: 'Observation',
        type: 'text',
        primary: true,
        aiPrompt: 'Write a concise safety observation title from: {{context}}',
      },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'area', label: 'Area / Location', type: 'text' },
      { key: 'observer', label: 'Observer', type: 'text' },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: ['ppe', 'fall-protection', 'housekeeping', 'electrical', 'equipment', 'hot-work', 'other'],
      },
      {
        key: 'risk',
        label: 'Risk Level',
        type: 'select',
        options: ['low', 'medium', 'high', 'imminent'],
      },
      {
        key: 'correctiveAction',
        label: 'Corrective Action',
        type: 'textarea',
        aiPrompt: 'Recommend a corrective action for this safety observation: {{context}}',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        options: ['open', 'in-progress', 'corrected', 'closed'],
      },
    ],
  },
  {
    id: 'change-order-log',
    title: 'Change Order Log',
    icon: '💲',
    description: 'Track proposed changes, cost, and schedule impact to approval.',
    views: ['table', 'kanban', 'cards', 'form'],
    fields: [
      { key: 'number', label: 'CO No.', type: 'text', primary: true },
      { key: 'description', label: 'Description', type: 'text' },
      {
        key: 'reason',
        label: 'Reason',
        type: 'select',
        options: ['owner-request', 'design-change', 'unforeseen-condition', 'code-requirement', 'error-omission'],
      },
      { key: 'costImpact', label: 'Cost Impact ($)', type: 'number' },
      { key: 'scheduleImpact', label: 'Schedule Impact (days)', type: 'number' },
      { key: 'submittedDate', label: 'Submitted', type: 'date' },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        options: ['proposed', 'pricing', 'submitted', 'approved', 'rejected'],
      },
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
