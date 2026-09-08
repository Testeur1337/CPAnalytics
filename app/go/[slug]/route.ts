import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentCampaign } from "@/lib/campaign";

export const runtime = "nodejs";

function pickDestination(destinationA: string, destinationB: string | null, weightA: number, weightB: number) {
  if (!destinationB || weightB <= 0) return destinationA;
  const total = Math.max(1, weightA + weightB);
  const random = Math.random() * total;
  return random < weightA ? destinationA : destinationB;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const campaign = await getOrCreateCurrentCampaign();
  const link = await prisma.link.findUnique({
    where: {
      campaignId_slug: {
        campaignId: campaign.id,
        slug
      }
    }
  });

  if (!link) {
    return new NextResponse("Link not found", { status: 404 });
  }

  const clickId = crypto.randomUUID().replace(/-/g, "");
  const destination = pickDestination(link.destinationA, link.destinationB, link.weightA, link.weightB);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  const ipHash = crypto.createHash("sha256").update(`${ip}${process.env.IP_HASH_SALT}`).digest("hex");

  const url = new URL(destination);
  url.searchParams.set("click_id", clickId);

  await prisma.click.create({
    data: {
      campaignId: campaign.id,
      linkId: link.id,
      clickId,
      videoId: req.nextUrl.searchParams.get("vid"),
      hookType: req.nextUrl.searchParams.get("hook"),
      contentType: req.nextUrl.searchParams.get("content"),
      offerName: req.nextUrl.searchParams.get("offer"),
      userAgent: req.headers.get("user-agent"),
      referrer: req.headers.get("referer"),
      ipHash
    }
  });

  return NextResponse.redirect(url, 302);
}
