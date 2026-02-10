-- SQLite migration
CREATE TABLE "Campaign" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "goalUSD" REAL NOT NULL DEFAULT 400,
  "startsAt" DATETIME NOT NULL,
  "endsAt" DATETIME NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Campaign_year_month_key" ON "Campaign"("year", "month");

CREATE TABLE "Link" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "campaignId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "destinationA" TEXT NOT NULL,
  "destinationB" TEXT,
  "weightA" INTEGER NOT NULL DEFAULT 100,
  "weightB" INTEGER NOT NULL DEFAULT 0,
  "tags" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Link_campaignId_slug_key" ON "Link"("campaignId", "slug");

CREATE TABLE "Click" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "campaignId" TEXT NOT NULL,
  "linkId" TEXT NOT NULL,
  "clickId" TEXT NOT NULL,
  "videoId" TEXT,
  "hookType" TEXT,
  "contentType" TEXT,
  "offerName" TEXT,
  "userAgent" TEXT,
  "referrer" TEXT,
  "ipHash" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Click_clickId_key" ON "Click"("clickId");

CREATE TABLE "Conversion" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "campaignId" TEXT NOT NULL,
  "clickId" TEXT NOT NULL,
  "payout" REAL NOT NULL DEFAULT 0,
  "txid" TEXT,
  "status" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("clickId") REFERENCES "Click"("clickId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Conversion_txid_key" ON "Conversion"("txid");
