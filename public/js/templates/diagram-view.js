// public/js/templates/diagram-view.js
// System architecture / flow diagram view.
// Groups records into layered columns and draws SVG connections between nodes
// based on a "connects to" field that references other node names.

const SVG_NS = 'http://www.w3.org/2000/svg';

const LAYER_ORDER = ['client', 'edge', 'application', 'data', 'external'];
const LAYER_LABEL = {
  client: 'Client',
  edge: 'Edge',
  application: 'Application',
  data: 'Data',
  external: 'External',
  other: 'Other',
};

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function fieldKey(schema, test, fallback) {
  return schema.fields.find((f) => test(f))?.key || fallback;
}

/**
 * @param {object} ctx
 * @param {object} ctx.schema
 * @param {Array}  ctx.records
 * @param {(record)=>void} ctx.onEdit  open the record for editing
 */
export function renderDiagramView({ schema, records, onEdit }) {
  const wrap = el('div', 'diagram-wrap');

  if (!records.length) {
    const empty = el('div', 'empty-state');
    empty.style.minHeight = '340px';
    empty.innerHTML =
      '<div><div class="big">🗺️</div>No components yet.<br>Click <b>＋ New Record</b> to add a node, or <b>🎲 Sample Data</b> to load a demo architecture you can edit.</div>';
    wrap.appendChild(empty);
    return wrap;
  }

  const nameKey = (schema.fields.find((f) => f.primary) || schema.fields[0]).key;
  const layerKey = fieldKey(schema, (f) => /layer|tier|group/i.test(f.key), 'layer');
  const typeKey = fieldKey(schema, (f) => /type|kind/i.test(f.key), 'type');
  const techKey = fieldKey(schema, (f) => /tech|stack|runtime/i.test(f.key), null);
  const connKey = fieldKey(schema, (f) => /connect|links?|depends|edges?/i.test(f.key), 'connectsTo');

  const board = el('div', 'diagram-board');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'diagram-svg');
  svg.innerHTML = `<defs>
    <marker id="wm-arrow" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
    </marker>
  </defs>`;
  board.appendChild(svg);

  // Group records by layer, preserving the canonical layer order.
  const groups = new Map(LAYER_ORDER.map((l) => [l, []]));
  const other = [];
  for (const r of records) {
    const layer = String(r.data[layerKey] || '').toLowerCase();
    if (groups.has(layer)) groups.get(layer).push(r);
    else other.push(r);
  }
  if (other.length) groups.set('other', other);

  const nodeEls = new Map(); // lowercased name -> element

  for (const [layer, list] of groups) {
    if (!list.length) continue;
    const col = el('div', 'diagram-col');
    col.appendChild(el('div', 'diagram-col-label', LAYER_LABEL[layer] || layer));
    for (const r of list) {
      col.appendChild(makeNode(r, { nameKey, typeKey, techKey, onEdit }, nodeEls));
    }
    board.appendChild(col);
  }

  wrap.appendChild(board);

  // Draw connections once laid out, and keep them in sync on resize.
  const draw = () => drawConnections(board, svg, records, nodeEls, { nameKey, connKey });
  requestAnimationFrame(draw);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => draw());
    ro.observe(board);
  }
  window.addEventListener('resize', draw);

  return wrap;
}

function makeNode(record, { nameKey, typeKey, techKey, onEdit }, nodeEls) {
  const node = el('div', 'arch-node');
  const name = record.data[nameKey] || '(unnamed)';
  const type = String(record.data[typeKey] || '').toLowerCase();
  node.dataset.type = type;
  node.dataset.name = String(name).toLowerCase();

  node.appendChild(el('h5', null, name));
  if (techKey && record.data[techKey]) {
    node.appendChild(el('div', 'node-tech', record.data[techKey]));
  }
  if (type) {
    const badge = el('span', 'pill node-type');
    badge.textContent = type;
    node.appendChild(badge);
  }
  node.addEventListener('click', () => onEdit?.(record));

  if (node.dataset.name) nodeEls.set(node.dataset.name, node);
  return node;
}

function drawConnections(board, svg, records, nodeEls, { nameKey, connKey }) {
  const w = board.scrollWidth;
  const h = board.scrollHeight;
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  // Clear previous edges (keep <defs>).
  svg.querySelectorAll('path.edge').forEach((p) => p.remove());

  const boardRect = board.getBoundingClientRect();
  const measure = (node) => {
    const r = node.getBoundingClientRect();
    const x = r.left - boardRect.left + board.scrollLeft;
    const y = r.top - boardRect.top + board.scrollTop;
    return { x, y, w: r.width, h: r.height, cx: x + r.width / 2, cy: y + r.height / 2 };
  };

  for (const r of records) {
    const from = nodeEls.get(String(r.data[nameKey] || '').toLowerCase());
    if (!from) continue;
    const targets = String(r.data[connKey] || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const a = measure(from);
    for (const tname of targets) {
      const to = nodeEls.get(tname);
      if (!to || to === from) continue;
      const b = measure(to);
      const start = edgePoint(a, b.cx, b.cy);
      const end = edgePoint(b, a.cx, a.cy);
      const mx = (start.x + end.x) / 2;

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', 'edge');
      path.setAttribute(
        'd',
        `M ${start.x} ${start.y} C ${mx} ${start.y}, ${mx} ${end.y}, ${end.x} ${end.y}`
      );
      path.setAttribute('marker-end', 'url(#wm-arrow)');
      svg.appendChild(path);
    }
  }
}

/** Point where the line from a rect's centre toward (tx,ty) crosses its edge. */
function edgePoint(rect, tx, ty) {
  const dx = tx - rect.cx;
  const dy = ty - rect.cy;
  if (dx === 0 && dy === 0) return { x: rect.cx, y: rect.cy };
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  const sx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const sy = dy === 0 ? Infinity : hh / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: rect.cx + dx * s, y: rect.cy + dy * s };
}
