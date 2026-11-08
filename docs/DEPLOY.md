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

## Project settings that matter (monorepo)
Both projects are connected to this GitHub repo and **must have a Root Directory**, otherwise Vercel builds from the repo root and fails
(`Couldn't find any 'pages' or 'app' directory` for the web app, `FASTAPI_ENTRYPOINT_NOT_FOUND` for the API):

| Project | Settings, General, Root Directory |
|---|---|
| `devoholics-web` | `apps/web` |
| `devoholics-api` | `apps/api` (so `app/main.py` is a default FastAPI entrypoint) |

## Redeploy
Pushing to `main` deploys both projects automatically. To redeploy without a commit, use the Vercel dashboard (Deployments, Redeploy)
or `npx vercel redeploy <deployment-url>`.

Do **not** run `vercel deploy` from inside `apps/web` or `apps/api` any more: with a Root Directory set, the CLI would look for
`apps/web/apps/web`. Deploy from the repository root, or just push.

Changing an env var: `printf '%s' "value" | npx vercel env add NAME production --force`, then redeploy. `NEXT_PUBLIC_*` values are inlined at build time.

## One manual step: Supabase Auth URLs
Supabase dashboard, Authentication, URL Configuration: set **Site URL** to the web URL and add it to **Redirect URLs**.
Otherwise sign-up confirmation emails link to localhost.
