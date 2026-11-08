# Deploying to Vercel

Two Vercel projects from this repo (both under the same account):

| Project | Root directory | URL |
|---|---|---|
| `devoholics-web` | `apps/web` (Next.js) | https://devoholics-web.vercel.app |
| `devoholics-api` | `apps/api` (FastAPI, Python 3.12, region `sin1` next to the database) | https://devoholics-api.vercel.app |

## Environment variables (Production)
**devoholics-api**: `DATABASE_URL` (Supabase *transaction pooler*, port 6543), `SUPABASE_URL`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`,
`CORS_ORIGINS` (comma-separated, must include the web URL).
**devoholics-web**: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (build-time: redeploy after changing).

## Serverless notes
- `app/db.py` detects `VERCEL`, uses `NullPool` and `prepare_threshold=None` so the transaction pooler works. Locally nothing changes.
- The AI endpoints can run for up to 60s (`vercel.json` `maxDuration`). Rate limits are per instance (in memory), so treat them as a soft guard.
- The daily data refresh is **not** a Vercel function: it runs from GitHub Actions (`refresh.yml`).

## Redeploy
```bash
cd apps/api && npx vercel deploy --prod --yes
cd apps/web && npx vercel deploy --prod --yes
```
Changing an env var: `printf '%s' "value" | npx vercel env add NAME production --force`, then redeploy.

## One manual step: Supabase Auth URLs
Supabase dashboard, Authentication, URL Configuration: set **Site URL** to the web URL and add it to **Redirect URLs**.
Otherwise sign-up confirmation emails link to localhost.
