# Doctor Reviews Malaysia

Mobile-first directory of private-hospital doctors (KL and Melaka) with patient reviews that link to their original sources.

**Stack:** Next.js 15 (App Router, TypeScript, server actions) · PostgreSQL (Neon) via `pg` · `exceljs` for Excel import/template · plain CSS · single-password admin with a signed HTTP-only cookie.

## Deploy on Vercel + Neon (free tiers)

1. **Neon:** create a free project at neon.com (pick the Singapore region). Copy the **pooled** connection string (Dashboard → Connect).
2. **Vercel:** import this GitHub repo (use the `claude/vercel-neon` branch, or merge it to `main` first). Framework is detected automatically.
3. In Vercel → Settings → Environment Variables add:
   - `DATABASE_URL`: the Neon connection string
   - `ADMIN_PASSWORD`: your admin password
   - `SESSION_SECRET`: a long random string
   - `SITE_URL`: your site address, e.g. `https://your-site.vercel.app`
   - `CONTACT_EMAIL`: your contact email
4. Deploy. Tables are created automatically on first request. Sign in at `/admin` and add specialties, procedures and hospitals.
5. Optional: in Vercel → Settings → Functions, set the region to Singapore so the site is next to the database.

Do **not** run the demo seed on the live database unless you want the sample doctors.

## Run locally

```bash
npm install
cp .env.example .env.local     # set DATABASE_URL (a free Neon database works), ADMIN_PASSWORD, SESSION_SECRET
npm run seed                   # optional demo data (needs DATABASE_URL in the environment)
npm run dev                    # http://localhost:3000  ·  admin: /admin
npm test                       # needs a throwaway Postgres: DATABASE_URL_TEST=postgres://user:pass@localhost:5432/dbname
```

## Layout

- `lib/db.ts` schema + thin async wrapper over `pg` (nested transactions use savepoints) · `lib/repo.ts` create/update + validation (single place enforcing duplicate rules) · `lib/normalize.ts` name normalisation, slugs, similarity
- `lib/import.ts` Excel parse / template / import (preview runs the real import in a rolled-back transaction, so preview and commit cannot disagree). Limit 300 rows per file to stay inside serverless time limits.
- `lib/queries.ts` public read queries (hidden doctors/reviews are filtered here) and SEO title/description builders
- `app/` public site (`/`, `/{kl|melaka}/{specialty}/{procedure?}`, `/doctors/{slug}`, `/search`, `/request-removal` (linked only from a small link at the bottom of the home page, to discourage spam), `/contact`) and `app/admin/**`
- `lib/hooks.ts` **placeholders** for the Discord webhook (server-side, `DISCORD_WEBHOOK_URL`), CAPTCHA and rate limiting; already called from the public form actions and currently no-ops

## Notes

- Doctors are unique on normalised name (trim, lowercase, leading "Dr"/"Dr." removed, spaces collapsed); hospitals on normalised name + city. Enforced by unique indexes in the database and in code.
- Review source link is required for every source type except "Patient submission" and must be http(s).
- There is deliberately no export feature.
- Doctor `slug` is generated once from the name and kept stable on edits unless the normalised name changes.
