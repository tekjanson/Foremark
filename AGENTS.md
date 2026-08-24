# AGENTS.md — Foremark

> **Foremark** — *Structure for anything you track.* A self-hosted, zero-cloud
> **template engine**: schema-driven templates rendered as tables, forms, kanban
> boards, cards, and architecture diagrams, with client-side encryption and
> one-off AI generation. This file is the operating manual for anyone (human or
> agent) extending Foremark. Read it first; it encodes the conventions and the
> working style this project was built with.

---

## 1. Core tenets (do not violate)

1. **Zero external SaaS / no Google dependency.** Everything runs self-hosted in
   one Node process or one Docker container. Data lives in embedded SQLite.
2. **Vanilla & standards-first.** No React/Vue/Webpack/bundlers. Native ES
   modules, native DOM APIs, plain CSS custom properties. **Zero build step** for
   client code — a browser loads `public/` directly.
3. **Schema-driven, zero hardcoded UI.** Every screen is generated from a
   template schema. Adding a "feature" usually means adding a template or a view
   renderer, not bespoke pages.
4. **Pervasive one-off AI.** Any field can be AI-filled; any text can be parsed
   into records. Provider-agnostic (OpenAI, Anthropic, Gemini, Ollama).
5. **Zero-knowledge encryption.** Sensitive fields are encrypted client-side and
   never leave the browser as plaintext.
6. **Build real, verify by running.** No stubs, no "should work." Prove it with
   tests and a live check (curl/browser) before declaring done.

---

## 2. Architecture

```
Browser SPA (public/js/app.js)  ──HTTP──▶  Node http server (server/server.js)
  ├─ crypto/ (Web Crypto vault)             ├─ routes/records.js  (templates, records, vault)
  ├─ templates/ (registry + views)          ├─ routes/ai.js       (/api/ai/generate, /extract)
  ├─ ai/ (client dispatcher)                 ├─ routes/export.js   (csv/html/json, import)
  ├─ storage/ (REST + localStorage)          ├─ ai-proxy.js        (OpenAI/Anthropic/Gemini/Ollama)
  └─ ui/ (toast, modal, theme)               └─ db.js              (better-sqlite3, WAL)
                                                     │
                                             ./data/waymark.db  (mounted volume)
```

- **No framework on either side.** The server is Node's native `http`; the
  client is hand-rolled ES modules. `server/http-util.js` has `sendJson` /
  `readJsonBody`.
- **Static + API in one server.** `/api/*` is routed; everything else serves
  `public/` with an SPA fallback to `index.html`.
- The live **System Architecture Map** template is a self-portrait of this
  diagram — load it in-app to see it.

---

## 3. Project layout (what lives where)

| Path | Responsibility |
| --- | --- |
| `server/server.js` | Native HTTP server, static host, API router, graceful shutdown |
| `server/db.js` | SQLite schema + all persistence (`templates`, `records`, `vault_settings`); `is_demo` column; migrations via `PRAGMA table_info` + `ALTER TABLE` |
| `server/ai-proxy.js` | Provider adapters + `generate()` / `extract()` + `parseJsonLoose()` |
| `server/routes/*.js` | `records.js` (CRUD, bulk, clear, demo-delete, vault), `ai.js`, `export.js` |
| `public/index.html` | SPA shell (sidebar, topbar, workspace) |
| `public/js/app.js` | Router + state + all wiring (toolbar, demo mode, vault UI, settings, cards view) |
| `public/js/templates/registry.js` | `BUILTIN_TEMPLATES`, `validateTemplate`, `RETIRED_BUILTIN_IDS`, helpers |
| `public/js/templates/{table,form,kanban,diagram}-view.js` | View renderers (cards is inline in `app.js`) |
| `public/js/crypto/{encryption,vault}.js` | AES-GCM + PBKDF2; session passphrase vault |
| `public/js/ai/{ai-client,prompts}.js` | Client AI dispatcher + prompt builders |
| `public/js/data/sample-data.js` | Demo-mode generator (semantic, per-field) + `architectureSample()` |
| `public/js/storage/{api-client,local-store}.js` | REST client + localStorage settings/cache |
| `public/js/ui/{toast,modal,theme}.js` | UI primitives |
| `public/css/{base,layout,templates}.css` | Tokens, shell, components (all responsive) |
| `tests/unit/*.test.js` | `node --test` suites (crypto, schema, sample-data) |
| `tests/e2e/*.spec.js` | Playwright (ingestion, vault) |

---

## 4. Domain model & conventions

**Template schema:**
```js
{ id, title, icon, description,
  views: ['table','form','kanban','cards','diagram'],
  fields: [{ key, label, type, options?, aiPrompt?, primary? }] }
```

- **Field types:** `text | textarea | select | number | date | status |
  encrypted | file`. `select`/`status` require `options`. `status` drives the
  Kanban columns.
- **`aiPrompt`** enables the ✨ magic-wand on a field. Supports `{{context}}`
  (other field values) and `{{field.key}}`.
- **`primary`** field is the card/kanban title (falls back to first field).
- **Records** are `{ id, templateId, data, isDemo, createdAt, updatedAt }`;
  `data` is arbitrary JSON keyed by field `key`.
- **Encryption payload format:** `enc:v1:<salt_b64>:<iv_b64>:<ct_b64>`.
  PBKDF2-SHA-256, 100k iterations, 16-byte salt; AES-GCM-256, 12-byte IV.

**Built-in templates** are seeded/upserted on client boot
(`ensureBuiltinTemplates` in `app.js`) so they stay canonical. To customize a
built-in without it being overwritten, **clone it** ("New Template").
`RETIRED_BUILTIN_IDS` are deleted on boot (how construction-era templates were
removed from the generic build).

---

## 5. Recipes (the fast paths)

**Add a template:** append an entry to `BUILTIN_TEMPLATES` in `registry.js`. It
seeds automatically. Add a unit assertion only if it has special data needs.

**Add a view type:** create `public/js/templates/<name>-view.js` exporting
`render<Name>View({ schema, records, onUpdate, onDelete, onEdit })` returning a
DOM node; import it and add a `case` in `renderWorkspace()`’s switch in
`app.js`; list the view name in a template’s `views`. (See `diagram-view.js` for
SVG overlay + measure-after-`requestAnimationFrame`.)

**Add an AI provider:** add an adapter in `ai-proxy.js` (`callX`), a `DEFAULTS`
entry, a `keyFor` case, and models in `PROVIDER_MODELS` (`ai-client.js`).

**Add a route:** add a handler in the relevant `server/routes/*.js` returning
`true` when handled; it’s already dispatched from `server.js`.

**Add sample data smarts:** extend `generateValue()` in `sample-data.js` with a
keyword match (order matters — specific before generic). Selects/status/dates
are handled automatically from the schema.

---

## 6. Dev workflow

```bash
npm install
npm start                 # http://localhost:3000  (DATA_DIR=./data)
npm run dev               # node --watch
npm test                  # unit (node --test 'tests/unit/*.test.js')
npx playwright test       # e2e (first run: npx playwright install chromium)
npm run test:all
```

- **Ports/data:** server honors `PORT` and `DATA_DIR`. Playwright uses a
  **per-run isolated `DATA_DIR`** (`data-e2e/run-<ts>`) so tests never collide.
- Always `rm -rf data-e2e test-results` after e2e runs to keep the tree clean.
- `.env` is **gitignored**; copy `.env.example`. Never read/print `.env` values —
  they hold API keys. Check presence via `GET /api/config` (booleans only) or
  `grep -oE '^[A-Z_]+=' .env` (names only).

---

## 7. Docker workflow (+ hard-won gotchas)

```bash
docker compose up -d --build      # build image + run (port 3000, ./data volume)
docker compose up -d --force-recreate   # reload env WITHOUT rebuild (no data change)
docker compose logs -f
```

- **Docker group not active in a pre-existing shell:** if you hit
  `permission denied ... docker.sock`, run commands as
  `sg docker -c "docker compose ..."` (the user is in the `docker` group but the
  session predates it). A freshly-opened terminal won’t need the wrapper.
- **Volume ownership:** the container runs as unprivileged `node` (uid 1000).
  If Docker auto-creates `./data` as `root`, SQLite fails with
  `SQLITE_CANTOPEN`. Fix: `rm -rf data && mkdir -p data` (recreates it owned by
  your uid 1000). Data survives container renames because it’s a host bind mount.
- **Env vs code:** `server/*` reads config from env at runtime. `docker-compose.yml`
  must explicitly forward each var (incl. `*_MODEL`). Overriding a model via
  `.env` + `--force-recreate` needs no rebuild.
- **Rebuild vs recreate:** `--build` bakes the current working tree into the
  image (and, on next app load, seeds that branch’s built-in templates into the
  shared volume). Use `--force-recreate` (no build) to pick up env-only changes
  without touching data or code.
- `better-sqlite3` compiles a native addon → the Alpine image installs
  `python3 make g++ libc6-compat`.

---

## 8. Testing philosophy

- **Unit** (`node --test`) for pure logic: crypto round-trips, schema
  validation, the sample-data generator.
- **E2E** (Playwright) for user flows: record CRUD + persistence, encryption
  lock/unlock, demo generate/remove, diagram render, AI-error handling.
- **Isolation:** reset shared server state in `beforeEach` (e.g. vault via
  `POST /api/vault/settings {}`), and use per-run data dirs.
- **Flake control:** for anything drawn on `requestAnimationFrame` (e.g. diagram
  SVG edges), assert with `expect.poll(...)`, not a one-shot `.count()`.
- **Prove it lives:** after container work, `curl /api/health` + `/api/config`,
  and drive the shared browser page for UI confirmation.

---

## 9. Notable learnings from this build

- **AI model names go stale.** `gemini-1.5-*` now 404 on `v1beta`; default is
  `gemini-flash-latest` and the API itself names the current model in errors.
  Prefer `-latest` aliases for defaults; keep the Settings dropdown current.
- **Demo Mode is reversible by design.** Generated records are tagged
  `is_demo=1`; turning Demo off calls `DELETE /api/records?demo=true` and wipes
  only those. Real records are never touched.
- **Preserve user data across renames.** When rebranding, the DB filename
  (`waymark.db`), the vault verification constant, and `localStorage` keys were
  deliberately left unchanged so existing data/settings survive.
- **Responsive is fluid, not device-specific.** Breakpoints at 1024px (tablet)
  and 760px (mobile): off-canvas sidebar + hamburger, stacked topbar, tables get
  min-width + horizontal scroll (inline AI wand hidden on mobile), kanban/diagram
  become swipeable columns.
- **Diagram connections** are measured after layout (`getBoundingClientRect`
  relative to the board + scroll offsets) and redrawn on resize.

---

## 10. Working style (how this project is built)

- **Tight scope, no over-engineering.** Implement what’s asked + what’s clearly
  necessary. No speculative abstractions, no docs/comments on untouched code.
- **Plan visibly, verify continuously.** Use a todo list for multi-step work;
  after each change, run tests and/or a live check before moving on.
- **Diagnose, don’t brute-force.** When something fails (Docker perms, flaky
  test, dead model), find the root cause and fix it; don’t retry blindly.
- **Security first.** Never route secrets through prompts or print `.env`. For
  HTTPS git pushes / password prompts, the user types secrets directly.
- **Branch per feature.** Generic/base work lands on `master`; themed or
  experimental packs live on branches (e.g. `construction-pack`) and are merged
  when ready. Keep `master` clean and generic.
- **Repo:** default branch is `master`; remote is SSH (`origin`).
