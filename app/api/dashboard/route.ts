import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDashboard } from "@/lib/analytics";
import { getOrCreateCurrentCampaign } from "@/lib/campaign";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const range = (req.nextUrl.searchParams.get("range") as "24h" | "7d" | "30d" | null) ?? "7d";
  const campaignId = req.nextUrl.searchParams.get("campaign");

  const campaign = campaignId
    ? await prisma.campaign.findUnique({ where: { id: campaignId } })
    : await getOrCreateCurrentCampaign();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const data = await buildDashboard(campaign.id, range);
  return NextResponse.json({ campaign, ...data });
}
