# ▦ Foremark

**Structure for anything you track.**

A **self-hosted, zero-cloud** template engine for structured data ingestion,
workflow automation, client-side encryption, and pervasive one-off AI
generation. No Google APIs, no OAuth, no remote database — everything runs in a
single container or a single `node` process, with data persisted to an embedded
SQLite database.

## Highlights

- **Zero external SaaS dependency.** Pure self-hosted. Runs in Docker or locally.
- **Vanilla & standards-first.** No React/Vue/Webpack. Native ES Modules, DOM
  APIs, and CSS custom properties. **Zero build step** for client code.
- **Pervasive one-off AI.** A "magic wand" ✨ on every field, plus a
  **Parse & Ingest** engine that turns unstructured text into structured
  records. Providers: OpenAI, Anthropic, Google Gemini, and local Ollama.
- **Zero-knowledge encryption.** Client-side AES-GCM-256 + PBKDF2 (Web Crypto).
  Encrypted values never leave your browser as plaintext.
- **Universal ingestion.** Schema-driven templates render as Table, Form,
  Kanban, and Card views with no hardcoded UI.

## Quick start

### Option 1 — Docker (recommended)

```bash
cp .env.example .env       # add API keys if you want server-side AI defaults
docker compose up          # builds and serves on http://localhost:3000
```

Data persists in the `./data` volume across restarts.

### Option 2 — Local Node (v20+)

```bash
cp .env.example .env
npm install
npm start                  # http://localhost:3000
```

## Configuration

All configuration is via environment variables (see [.env.example](.env.example)):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | SQLite + backup directory |
| `DEFAULT_AI_PROVIDER` | `openai` | Fallback provider |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | — | Provider keys |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local Ollama endpoint |

> AI keys can also be entered per-browser in **⚙ Settings** — those are stored
> only in `localStorage` and sent per-request, never written to the database.

## Built-in templates

- **RFI / Technical Query Manager** — Subject, Spec Section, Description,
  Suggested Solution, Status, Priority.
- **Daily Field Log & Inspection** — Date, Location, Weather, Crew Count, Work
  Completed, Safety Issues.
- **Encrypted Secrets & Credentials Vault** — Service, Username, Encrypted
  Secret, Notes.
- **Flexible Spreadsheet Grid** — user-defined columns.

New templates can be created and existing schemas edited from the UI.

## The vault (encryption)

1. Click **Vault → Create vault** and choose a master passphrase.
2. Fields of type `encrypted` display a 🔒 and a **Set / Reveal** control.
3. Values are encrypted client-side as
   `enc:v1:<salt_b64>:<iv_b64>:<ciphertext_b64>` before ever touching the
   network.
4. **Lock** the vault to render encrypted fields unreadable; unlock with the
   same passphrase to reveal them. The passphrase is never stored — only a
   verification token (a known string encrypted with it) is persisted.

Crypto parameters: PBKDF2-SHA-256 (100,000 iterations, 16-byte salt),
AES-GCM-256 with a 12-byte IV.

## AI workflows

- **Field fill:** click ✨ next to any text field to generate a context-aware
  value using the other fields as context.
- **Parse & Ingest:** paste raw notes/logs and the model maps them into
  structured records matching the active template schema.

## REST API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/config` | Server AI provider availability |
| `GET/POST` | `/api/templates` | List / upsert templates |
| `GET/DELETE` | `/api/templates/:id` | Fetch / delete a template |
| `GET/POST` | `/api/records` | List (`?templateId=&q=`) / create records |
| `GET/PUT/DELETE` | `/api/records/:id` | Fetch / update / delete a record |
| `GET/POST` | `/api/vault/settings` | Vault verification token |
| `POST` | `/api/ai/generate` | Provider-agnostic text generation |
| `POST` | `/api/ai/extract` | Structured JSON extraction |
| `GET` | `/api/export/json` | Full JSON backup |
| `POST` | `/api/import/json` | Restore a JSON backup |
| `GET` | `/api/export/csv?templateId=` | CSV export |
| `GET` | `/api/export/html?templateId=` | Printable HTML (Print → PDF) |

## Project layout

```text
server/                 Native-HTTP server, SQLite persistence, AI proxy, routes
public/                 Zero-build ES-module SPA (crypto, ai, templates, ui)
tests/unit/             node:test suites (crypto, schema)
tests/e2e/              Playwright suites (ingestion, vault)
```

## Testing

```bash
npm test          # unit tests (crypto round-trip, schema validation)
npm run test:e2e  # Playwright E2E (record CRUD, encryption round-trip, AI errors)
npm run test:all  # both
```

> First E2E run: `npx playwright install chromium`.

## Security notes

- Encrypted fields are AES-GCM authenticated; a wrong passphrase fails closed.
- The static file server normalizes paths to prevent traversal.
- Request bodies are size-capped (10 MB).
- Provider API keys entered in the browser stay in `localStorage`.

## License

MIT
