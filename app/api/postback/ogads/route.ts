import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function fromValue(v: string | null) {
  return v && v.length > 0 ? v : null;
}

export async function POST(req: NextRequest) {
  let payload: Record<string, string | null> = {};
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await req.json();
    payload = {
      click_id: json.click_id ?? null,
      payout: json.payout?.toString() ?? null,
      txid: json.txid ?? null,
      status: json.status ?? null,
      secret: json.secret ?? null
    };
  } else {
    payload = {
      click_id: req.nextUrl.searchParams.get("click_id"),
      payout: req.nextUrl.searchParams.get("payout"),
      txid: req.nextUrl.searchParams.get("txid"),
      status: req.nextUrl.searchParams.get("status"),
      secret: req.nextUrl.searchParams.get("secret")
    };
  }

  if (!payload.click_id) {
    return new NextResponse("Missing click_id", { status: 400 });
  }

  if (process.env.POSTBACK_SECRET && payload.secret !== process.env.POSTBACK_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const click = await prisma.click.findUnique({ where: { clickId: payload.click_id } });
  if (!click) {
    return new NextResponse("Click not found", { status: 404 });
  }

  const txid = fromValue(payload.txid);
  if (txid) {
    const existing = await prisma.conversion.findUnique({ where: { txid } });
    if (existing) return new NextResponse("OK", { status: 200 });
  }

  await prisma.conversion.create({
    data: {
      campaignId: click.campaignId,
      clickId: click.clickId,
      payout: Number(payload.payout ?? 0),
      txid,
      status: fromValue(payload.status)
    }
  });

  return new NextResponse("OK", { status: 200 });
}
