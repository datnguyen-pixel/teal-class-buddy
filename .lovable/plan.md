# Migration Export Plan

Goal: get you a complete, importable backup of this project for a new self-owned Supabase account — starting with everything we can grab right now (no DB needed), and automatically completing the data-side export the moment the Postgres instance comes back online.

---

## Track 1 — Run immediately (no DB required)

Produce a downloadable bundle at `/mnt/documents/migration-bundle/` containing every asset that lives in the Git repo or in tools we can reach without the database.

Contents:

1. **`supabase/migrations/`** — full copy of every SQL migration file, in order. This recreates the schema, RLS policies, functions, triggers, and enums on a fresh project via `supabase db push`.
2. **`supabase/functions/`** — every edge function source folder (handlers, shared code, `deno.json` if present).
3. **`supabase/config.toml`** — project-level config (will need its `project_id` updated for the new project).
4. **`app-source/`** — pointer note explaining the entire `src/`, `public/`, `package.json`, `vite.config.ts`, `tailwind.config.ts`, etc. is the same Git repo; no copy needed, just re-point `VITE_SUPABASE_URL` / keys.
5. **`SECRETS_TO_RECONFIGURE.md`** — list of secret **names** currently set (`LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus any others discovered via `fetch_secrets`), with instructions on which must be regenerated in the new project vs re-pasted from your own records. Values are never exported.
6. **`.env.template`** — blank template showing which `VITE_*` variables the app expects.
7. **`MIGRATION_RUNBOOK.md`** — step-by-step instructions:
   - Create new Supabase project in your own account
   - Link CLI: `supabase link --project-ref <new-ref>`
   - Apply schema: `supabase db push`
   - Deploy functions: `supabase functions deploy <name>` per function
   - Set runtime secrets in new project dashboard
   - Update `.env` / Lovable env with new URL + anon key
   - Run Track 2 data import (instructions cross-referenced)
8. **`bundle.zip`** — zipped version of the whole folder for one-click download.

Deliverable: a `<presentation-artifact>` for `bundle.zip` so you can download it right away.

---

## Track 2 — Queued, auto-runs when DB recovers

A polling loop will call `supabase--cloud_status` + a probe `SELECT 1` every ~60s. As soon as both succeed, it executes the data-side export and appends results to the same bundle.

Contents added on recovery:

1. **`schema-introspection.sql`** — `pg_dump --schema-only` of `public` (cross-checks the migrations).
2. **`data/public-*.sql`** — `pg_dump --data-only --inserts` of every public table (assignments, blocked_users, lesson_comments, lessons, messages, notifications, profiles, reactions, spelling_games, spelling_items, submissions, user_roles, vocab_games, vocab_items).
3. **`data/auth-users.sql`** — export of `auth.users` + `auth.identities` (id, email, provider, encrypted_password, metadata) so logins survive the move. Includes a re-import script for the new project.
4. **`storage/buckets.json`** — list of buckets with public/private flags, size limits, allowed MIME types.
5. **`storage/objects-manifest.json`** — every object's bucket, path, owner, size, content-type, created_at.
6. **`storage/files/<bucket>/...`** — actual binary downloads of every object via the Storage API (lesson attachments, avatars, submission audio, etc.).
7. **`rls-policies.sql`** — dump of all RLS policies for verification.
8. **`CONSISTENCY_REPORT.md`** — row counts per table, file counts per bucket, auth user count, plus any items that failed to export.
9. Refreshed **`bundle.zip`** with everything.

You'll get a chat notification when Track 2 completes (or if it fails partway, with what succeeded).

---

## What you'll do after both tracks finish

1. Create your own Supabase project (free tier is fine to start).
2. Follow `MIGRATION_RUNBOOK.md` — apply migrations, deploy functions, import data, import auth users, upload storage files.
3. Point this Lovable app at the new project by updating `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or, if you want to keep using Lovable Cloud, you can instead use the bundle as a disaster-recovery snapshot).
4. Verify by signing in as a test user and checking lessons/messages render.

---

## Limitations to call out

- **Auth passwords**: exporting `encrypted_password` from `auth.users` works only if the new project uses the same JWT secret hashing scheme (it does, by default). OAuth-only users (your students on Google) re-link automatically on next sign-in — no password needed.
- **Edge function secrets**: values can't be exported (they're write-only). You'll re-enter them in the new project. The bundle lists their names.
- **Realtime publication** (`supabase_realtime ADD TABLE ...`): captured in the migrations; verify after import.
- **If Postgres never recovers**: Track 1 alone still lets you stand up a new project with full schema + code + functions, but without user data, messages, lesson content rows, or stored files. Track 2 is the only way to recover those.

---

## Technical details

- Polling cadence: 60s, max 6 hours, then pause and notify you.
- `pg_dump` runs via `psql`/`pg_dump` against `SUPABASE_DB_URL` (already in secrets).
- Storage file download uses `supabase--storage_upload`'s sibling read path via service role key + signed listing.
- All outputs land in `/mnt/documents/migration-bundle/` so they persist and are downloadable.
- Nothing is written back to the live database during export — read-only.