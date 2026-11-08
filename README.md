# DEVOHOLICS

Developer intelligence and architecture workspace: **Discover. Explore. Architect. Build.**

- **Feed / Explore**: live ecosystem data from GitHub, npm, PyPI, Hugging Face and the MCP registry, with four independent
  signals per technology (momentum, maintenance, ecosystem, readiness) and no hidden combined score. Missing data is shown as missing.
- **Playground**: a React Flow canvas for designing architectures from real technologies, with validation, versioning,
  and an AI assistant that only *proposes* changes you accept or reject.
- **Blueprints**: curated and community architecture templates you can fork. Community content goes through moderation.
- **My Library**: saved and followed technologies, interests, collections.

## Layout
`apps/api` FastAPI + SQLAlchemy + Alembic (Postgres via Supabase) · `apps/web` Next.js 16 + Tailwind + React Flow · `docs/` notes.

## Quick start
```bash
cp .env.example .env                      # fill in DATABASE_URL, GITHUB_TOKEN, SUPABASE_*, optional LLM_API_KEY
cd apps/api && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/alembic upgrade head
.venv/bin/python -m app.cli seed && .venv/bin/python -m app.cli refresh && .venv/bin/python -m app.cli blueprints
.venv/bin/uvicorn app.main:app --port 8010
cd ../web && cp .env.example .env.local && npm install && npm run dev     # NEXT_PUBLIC_API_URL=http://localhost:8010
```
Tests: `cd apps/api && .venv/bin/pytest` · `cd apps/web && npm test`.
Moderator: sign in once, then `python -m app.cli make-admin you@example.com` and open `/admin`.
AI assistant: set `LLM_API_KEY` (free key from Groq, or any OpenAI-compatible provider). Without it everything else works.

See [docs/PHASE_NOTES.md](docs/PHASE_NOTES.md) for architecture decisions, data rules and status.
