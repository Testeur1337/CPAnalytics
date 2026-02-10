# CPA Tracker Hub

Next.js 14 + TypeScript + Prisma tracking app for monthly CPA campaign monitoring.

## Tech Stack
- Next.js 14 App Router
- Prisma ORM
- PostgreSQL datasource (`provider = "postgresql"`)
- Node runtime routes (no edge)

## Environment Variables
Create `.env` from `.env.example`.

- `DATABASE_URL` (required): PostgreSQL connection string
- `IP_HASH_SALT` (required)
- `POSTBACK_SECRET` (optional)

Example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
IP_HASH_SALT="change_me"
POSTBACK_SECRET=""
```

## Local Run
Use any PostgreSQL database (local Docker/Postgres app, Neon/Supabase, or your Render database URL).

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## Render setup
1. In Render, create a **PostgreSQL** database (Render free Postgres is fine for testing).
2. Create a **Web Service** for this repo.
3. Set `DATABASE_URL` in the service using the connection string from your Render PostgreSQL database.
4. Set `IP_HASH_SALT` (required) and optional `POSTBACK_SECRET`.
5. Build command:
   ```bash
   npm install && npx prisma generate && npx prisma migrate deploy && npm run build
   ```
6. Start command:
   ```bash
   npm run start
   ```

> Prisma provider is hardcoded to `postgresql` in `prisma/schema.prisma`.

## API Routes
### Create Link
`POST /api/links`

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

## Compliance
This app only provides legit redirect + conversion tracking infrastructure and does not automate deceptive CPA behavior.
