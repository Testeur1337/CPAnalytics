import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentCampaign } from "@/lib/campaign";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9_-]+$/i),
  destinationA: z.string().url(),
  destinationB: z.string().url().optional().nullable(),
  weightA: z.number().int().min(0).max(100).default(100),
  weightB: z.number().int().min(0).max(100).default(0),
  tags: z.string().optional().nullable()
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const campaign = await getOrCreateCurrentCampaign();

    const existing = await prisma.link.findUnique({
      where: {
        campaignId_slug: {
          campaignId: campaign.id,
          slug: body.slug
        }
      }
    });

    if (existing) {
      return NextResponse.json({ error: "Slug already exists in current campaign" }, { status: 400 });
    }

    const link = await prisma.link.create({
      data: {
        campaignId: campaign.id,
        name: body.name,
        slug: body.slug,
        destinationA: body.destinationA,
        destinationB: body.destinationB ?? null,
        weightA: body.weightA,
        weightB: body.weightB,
        tags: body.tags ?? null
      }
    });

    return NextResponse.json({ link });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
