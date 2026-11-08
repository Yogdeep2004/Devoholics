# Phase notes

## Phase 0 – Foundation (done)
Greenfield repo. Monorepo: `apps/api` (FastAPI, SQLAlchemy 2, Alembic, pytest). `apps/web` comes in Phase 2.
Decisions: Celery/Redis deferred (idempotent CLI jobs instead); direct LLM integration, no LangChain;
graphs as versioned JSONB; all metrics from official APIs only, `null` = unknown.

## Phase 1 – Intelligence backend (done)
GitHub, npm, PyPI, Hugging Face and MCP-registry collectors (retry/backoff, rate-limit handling, 404 -> skipped).
One snapshot per repo per UTC day; growth/acceleration math; release detection -> feed events; derived events
(recent releases, maintenance warnings only for repos >= 1000 stars); four independent dimensions (no combined score).
274 technologies (140 curated, 40 HF models, ~94 MCP servers with live GitHub repos), 45 packages.
Scheduling: `.github/workflows/refresh.yml` runs `python -m app.cli refresh` daily (needs repo secrets
`DATABASE_URL`, `GH_API_TOKEN`). HF "stars" are likes (labelled). PyPI weekly downloads are unknown by design.

## Phase 2 – Intelligence interface (done)
Next.js 16 app in `apps/web`: Feed (type/window/sort filters, "why am I seeing this", transparent ranking),
Explore (search, category, sort), technology profiles (history chart, four dimensions, packages, freshness),
Supabase email/password auth (backend verifies ES256 JWTs via JWKS), Save/Follow, interests, My Library.
Public pages work without an account. Hydration note: `useAuth().ready` is false until after hydration.

## Phase 3 – Architecture Playground (done)
Backend: versioned graphs (JSONB) with Pydantic schema; validation (duplicate ids, unknown tech/types, dangling edges,
self loops, bad parents; warnings for disconnected nodes); edge status `verified` (verified relationship on record) |
`compatible` (structural pattern for component types, NOT proof products integrate) | `unverified` (custom/no rule).
Ownership enforced server-side (others get 404), private by default, restore appends a version, duplicate, collections.
Frontend: React Flow canvas, Zustand store, searchable component library (starter set + whole DB, drag or click),
groups/layers/notes, inspector with technology profile + alternatives + replace, Visual/Technical views,
live validation, version history + restore. Verified by a Playwright run (create/add/connect/validate/save/reload/
delete/restore/technical view).
Not yet: blueprint templates (Phase 6), opening a technology in the Playground from its profile (Phase 5).

## Phase 4 – AI assistant (done; live model needs a key)
Provider: any OpenAI-compatible API via `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`. Default is Groq
(`openai/gpt-oss-120b`): free tier, no card, key at https://console.groq.com/keys. Sources disagree on whether Groq enforces
strict JSON schemas for this model, so correctness never depends on it: output is parsed, Pydantic-validated, and gets one
repair attempt with the error fed back. Swap providers by changing the three env vars.
Protocol (never bypassed): request -> graph + candidate technologies (fenced as untrusted `<data>`) -> LLM JSON ->
Pydantic `Proposal` -> deterministic `apply_proposal` + graph validation (explicit errors, one repair round) -> stored as a
pending `ai_suggestions` row with a diff and preview -> user accepts all/some operations or rejects -> accept re-validates,
refuses stale proposals (architecture changed), and appends a new version. The original graph is never mutated by a proposal.
Endpoints: `/architectures/{id}/ai/{generate,alternatives,optimize,explain,review,suggestions,...}`, `/architectures/ai/compare`.
Review = deterministic rules (source "rule") + optional AI findings (source "ai"); works without any key.
Compare is computed from graphs + DB; AI narrative is optional. AI answers are shown separately from "Verified data".
Per-user rate limit: `AI_REQUESTS_PER_MINUTE` (default 10). Not yet verified against a live model (no key was available).

## Phase 5 – Intelligence <-> architecture integration (done)
Profile "Open in Playground" (adds the technology as a new version of an existing/new design via
`POST /architectures/{id}/add-technology`); inspector has profile link + alternatives + replace; the feed knows which
technologies are in your saved designs (`used_in`, ranking boost "used in one of your saved architectures", "My stack"
filter); feed cards link to `/playground/{id}?investigate={nodeId}`, which opens the design with the node selected and the
Assistant tab ready. Nothing is ever auto-replaced; the AI only runs when you click. Release events and verified
maintenance warnings reach you through the same feed.

## Run
    cd apps/api && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
    cp .env.example .env   # repo root; fill in values (never commit)
    .venv/bin/alembic upgrade head
    .venv/bin/python -m app.cli seed && .venv/bin/python -m app.cli refresh   # also: mcp, models, packages, events
    .venv/bin/uvicorn app.main:app --port 8010 --reload
    cd apps/web && cp .env.example .env.local && npm i && npm run dev        # set NEXT_PUBLIC_API_URL
    pytest (apps/api) ; npm test (apps/web)
Endpoints: /health, /api/v1/{categories,technologies,trending,feed,components,connection-types}, /me/*, /architectures/*, /collections/*.

## Env vars
Backend: DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, GITHUB_TOKEN, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, AI_REQUESTS_PER_MINUTE, CORS_ORIGINS, LOG_LEVEL.
Web: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
Supabase direct DB host is IPv6-only; use the Session pooler URL.
