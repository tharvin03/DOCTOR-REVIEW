# Doctor Reviews Malaysia

Mobile-first directory of private-hospital doctors (KL and Melaka) with patient reviews that link to their original sources.

**Stack:** Next.js 15 (App Router, TypeScript, server actions) · SQLite via `better-sqlite3` · `exceljs` for Excel import/template. Plain CSS. Single-password admin with a signed HTTP-only cookie.

## Run

```bash
npm install
cp .env.example .env.local     # set ADMIN_PASSWORD and SESSION_SECRET
npm run seed                   # optional demo data (orthopedics, 2 hospitals, sample doctors/reviews)
npm run dev                    # http://localhost:3000  ·  admin: /admin
npm test                       # unit tests (normalisation, uniqueness, import)
```

Production: `npm run build && npm start`. The SQLite file lives at `DATABASE_PATH` (default `./data/app.db`); back it up like any file. The schema is created automatically (`lib/db.ts`).

## Layout

- `lib/db.ts` schema · `lib/repo.ts` create/update + validation (single place enforcing duplicate rules) · `lib/normalize.ts` name normalisation, slugs, similarity
- `lib/import.ts` Excel parse / template / import (preview runs the real import in a rolled-back transaction, so preview and commit cannot disagree)
- `lib/queries.ts` public read queries (hidden doctors/reviews are filtered here) and SEO title/description builders
- `app/` public site (`/`, `/{kl|melaka}/{specialty}/{procedure?}`, `/doctors/{slug}`, `/search`, `/request-removal`, `/contact`) and `app/admin/**`
- `lib/hooks.ts` **placeholders** for the Discord webhook (server-side, `DISCORD_WEBHOOK_URL`), CAPTCHA and rate limiting; already called from the public form actions and currently no-ops

## Notes

- Doctors are unique on normalised name (trim, lowercase, leading "Dr"/"Dr." removed, spaces collapsed); hospitals on normalised name + city. Enforced in the DB (unique indexes) and in code.
- Review source link is required for every source type except "Patient submission" and must be http(s).
- There is deliberately no export feature.
- Doctor `slug` is generated once from the name and kept stable on edits unless the normalised name changes.
