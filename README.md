# CPA Tracker Hub

Next.js 14 + TypeScript + Prisma tracking app for monthly CPA campaign monitoring.

## Features
- Monthly campaign auto-reset (year/month campaign with one active campaign at a time).
- Link creation inside current campaign.
- Redirect tracking route (`/go/[slug]`) with weighted destination split and click_id append.
- Postback ingestion route for OGAds-compatible callbacks.
- Dashboard API and UI with KPIs, video/hook/offer analytics, and SCALE/TEST/KILL decisions.
- IP hashing only (raw IP is never stored).

## Tech Stack
- Next.js 14 App Router
- Prisma ORM
- SQLite for test mode (default)
- PostgreSQL-ready mode for paid deploys
- Node runtime routes (no edge)

## Environment Variables
Create `.env` from `.env.example`.

- `DATABASE_URL`
  - If it starts with `postgres`, Prisma is prepared for PostgreSQL during install/build.
  - Otherwise defaults to SQLite `file:./prisma/dev.db`.
- `IP_HASH_SALT` (required)
- `POSTBACK_SECRET` (optional)

Example `.env` for free test:

```env
DATABASE_URL="file:./prisma/dev.db"
DATABASE_PROVIDER="sqlite"
IP_HASH_SALT="change_me"
POSTBACK_SECRET=""
```

## Local Run
```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## API Routes
### Create Link
`POST /api/links`

JSON body:
```json
{
  "name": "Free CV tool",
  "slug": "freecv",
  "destinationA": "https://example.com/a",
  "destinationB": "https://example.com/b",
  "weightA": 80,
  "weightB": 20,
  "tags": "cv,lead"
}
```

### Redirect / Track Click
`GET /go/[slug]`

Example:
`/go/freecv?vid=short_012&hook=free_tool&content=cv&offer=ai_cv_tool`

### Postback
`POST /api/postback/ogads`

Supports query params or JSON with:
- `click_id` (required)
- `payout`
- `txid`
- `status`
- `secret`

Example:
`/api/postback/ogads?click_id={click_id}&payout={payout}&txid={txid}&status=approved&secret=...`

### Dashboard Data
`GET /api/dashboard?campaign=<id optional>&range=24h|7d|30d`

## Decision Logic
Computed server-side:
- SCALE: conversions >= 2 and clicks >= 50 and epc >= 0.20
- TEST: (clicks 20-49 and conversions >= 1) OR (clicks >= 50 and conversions < 2 and epc 0.10-0.19)
- KILL: clicks >= 80 and conversions == 0

## Render FREE Deploy Instructions
1. Create **Web Service** on Render.
2. Connect this repo.
3. Build command:
   ```bash
   npm install && npx prisma generate && npx prisma migrate deploy && npm run build
   ```
   (`npm install` runs `postinstall`, which auto-prepares Prisma for SQLite or PostgreSQL based on `DATABASE_URL`.)
4. Start command:
   ```bash
   npm run start
   ```
5. Environment variables:
   - `DATABASE_URL=file:./prisma/dev.db`
   - `IP_HASH_SALT=<your-random-salt>`
   - `POSTBACK_SECRET=<optional>`

### Important for Render free
Render free uses an ephemeral filesystem. Local SQLite data may reset on deploys/restarts. This app still works for testing but persistence is best-effort only.

## Upgrade Later to PostgreSQL
1. Create a Render Postgres database (paid/free tier if available).
2. Set env:
   - `DATABASE_URL=postgres://...`
3. Redeploy. `postinstall` auto-selects the PostgreSQL schema/migrations, then `prisma migrate deploy` applies them in the build step.

## Compliance
This app only provides legit redirect + conversion tracking infrastructure and does not automate deceptive CPA behavior.
