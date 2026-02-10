-- PostgreSQL-compatible migration reference
CREATE TABLE "Campaign" (
  "id" TEXT PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "goalUSD" DOUBLE PRECISION NOT NULL DEFAULT 400,
  "startsAt" TIMESTAMP NOT NULL,
  "endsAt" TIMESTAMP NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Campaign_year_month_key" ON "Campaign"("year", "month");

CREATE TABLE "Link" (
  "id" TEXT PRIMARY KEY,
  "campaignId" TEXT NOT NULL REFERENCES "Campaign"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "destinationA" TEXT NOT NULL,
  "destinationB" TEXT,
  "weightA" INTEGER NOT NULL DEFAULT 100,
  "weightB" INTEGER NOT NULL DEFAULT 0,
  "tags" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Link_campaignId_slug_key" ON "Link"("campaignId", "slug");

CREATE TABLE "Click" (
  "id" TEXT PRIMARY KEY,
  "campaignId" TEXT NOT NULL REFERENCES "Campaign"("id") ON DELETE CASCADE,
  "linkId" TEXT NOT NULL REFERENCES "Link"("id") ON DELETE CASCADE,
  "clickId" TEXT NOT NULL UNIQUE,
  "videoId" TEXT,
  "hookType" TEXT,
  "contentType" TEXT,
  "offerName" TEXT,
  "userAgent" TEXT,
  "referrer" TEXT,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Conversion" (
  "id" TEXT PRIMARY KEY,
  "campaignId" TEXT NOT NULL REFERENCES "Campaign"("id") ON DELETE CASCADE,
  "clickId" TEXT NOT NULL REFERENCES "Click"("clickId") ON DELETE CASCADE,
  "payout" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "txid" TEXT UNIQUE,
  "status" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
