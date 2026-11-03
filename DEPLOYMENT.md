# Kisan AI — Deployment & Environment Reference

## Architecture

| Piece | Host | Repo path |
|---|---|---|
| Frontend (React + Vite) | Vercel | `client/` |
| Backend API (Express) | Render | `server/` + root `package.json` |
| Database | MongoDB Atlas | — |
| AI | Google Gemini | key on Render only |
| Mandi prices | data.gov.in (Agmarknet) | key on Render only |
| Images | Cloudinary | keys on Render only |

The frontend talks to the backend through **one** central axios instance
(`client/src/services/api.js`). Its base URL resolves in this order:

1. `VITE_API_URL` (recommended)
2. `VITE_API_BASE_URL` (legacy alias)
3. Production default: `https://kisan-ai-1-7ilu.onrender.com/api`
4. Dev default: `http://localhost:5000/api`

CORS on the backend allows: the hardcoded `https://kisan-ai-seven.vercel.app`,
`http://localhost:5173`, **and** whatever `CLIENT_URL` is set to on Render.
Set `CLIENT_URL` on Render to your exact Vercel domain (no trailing slash).

---

## Vercel Environment Variables (Project Settings → Environment Variables)

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://kisan-ai-1-7ilu.onrender.com/api` |

That is the only required variable. Secrets (AI, DB, Cloudinary, data.gov)
must **never** be added to Vercel — the frontend has none.

`vercel.json` is not required; Vite output is `client/dist`
(Build Command `npm run build`, Output Directory `dist`, Root `client`).
Add a SPA rewrite if refreshing deep links 404s:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

---

## Render Environment Variables (Service → Environment)

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | ✅ | Atlas connection string (keep DB name `kisan-db`) |
| `JWT_SECRET` | ✅ | random 32+ byte hex — do NOT reuse the dev one |
| `JWT_EXPIRES_IN` | – | default `7d` |
| `NODE_ENV` | ✅ | `production` |
| `CLIENT_URL` | ✅ | your exact Vercel origin, e.g. `https://kisan-ai-seven.vercel.app` |
| `PORT` | ✅ | Render usually injects it; do not hardcode |
| `GEMINI_API_KEY` | ✅ (AI) | Google AI Studio key — backend only |
| `GEMINI_MODEL` | – | default `gemini-3.5-flash` |
| `GEMINI_FALLBACK_MODEL` | – | comma separated fallbacks |
| `GEMINI_MAX_RETRIES` / `GEMINI_TIMEOUT_MS` | – | retry tuning |
| `CLOUDINARY_URL` **or** all three of `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | ✅ (images) | backend only |
| `DATA_GOV_API_KEY` | ✅ (live mandi) | free key from https://data.gov.in — without it the app shows cached/manual prices, labelled honestly as not live |
| `DATA_GOV_RESOURCE_ID` | – | defaults to the Agmarknet current-daily-price dataset |
| `AUTH_RATE_LIMIT_MAX` | – | default `10` per 15 min |

Start command: `node server/server.js` (or `npm run server`).
Node version: Node 20+ (uses `AbortSignal.timeout`).

---

## Local commands

```bash
npm install            # backend deps (root)
cd client && npm install

npm run dev            # backend on :5000 (loads root .env)
npm run seed           # FULL WIPE + fixtures — remote hosts need: npm run seed -- --force
npm run seed:catalog   # NON-destructive: upsert store/grain/mandi catalog only
node server/scripts/makeAdmin.mjs you@email.com yourpassword   # promote/create an admin

npm test               # unit + integration suite (dedicated *-test database, prod never touched)

cd client
npm run dev            # frontend on :5173
npm run build          # production build to dist/
```

## Test isolation

`npm test` derives a dedicated test database from `MONGO_URI` (database name
suffix `-test`, or override with `TEST_MONGO_URI`), wipes only *that* database,
seeds fixtures, and points the test server at it. Production data is never
read or written by the test suite. AI/Cloudinary/data.gov keys are blanked in
the test env so tests assert the honest "not configured" errors.

## Ops scripts

| Script | Purpose |
|---|---|
| `node server/scripts/fillCatalog.mjs` | upsert-only catalog fill (products/grains/mandi), safe on production |
| `node server/scripts/makeAdmin.mjs <email> [password]` | promote an existing user to ADMIN or create one |
| `node server/scripts/check-cloudinary.mjs` | verify Cloudinary credentials |
