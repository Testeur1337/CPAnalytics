import { prisma } from "./prisma";
import { decide } from "./decision";

const dayMs = 24 * 60 * 60 * 1000;

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export async function buildDashboard(campaignId: string, range: "24h" | "7d" | "30d" = "7d") {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  const now = new Date();
  const fromRange = new Date(now.getTime() - (range === "24h" ? 1 : range === "7d" ? 7 : 30) * dayMs);
  const dayStart = startOfDay();
  const sevenDays = new Date(now.getTime() - 7 * dayMs);

  const [todayClicks, todayConv, totalConv, clicks7d, conv7d, allClicks] = await Promise.all([
    prisma.click.count({ where: { campaignId, createdAt: { gte: dayStart } } }),
    prisma.conversion.aggregate({ where: { campaignId, createdAt: { gte: dayStart } }, _sum: { payout: true } }),
    prisma.conversion.aggregate({ where: { campaignId }, _sum: { payout: true } }),
    prisma.click.findMany({ where: { campaignId, createdAt: { gte: sevenDays } } }),
    prisma.conversion.findMany({ where: { campaignId, createdAt: { gte: sevenDays } } }),
    prisma.click.findMany({ where: { campaignId, createdAt: { gte: fromRange } } })
  ]);

  const earnings = totalConv._sum.payout ?? 0;
  const remaining = Math.max(0, campaign.goalUSD - earnings);
  const daysLeft = Math.max(1, Math.ceil((campaign.endsAt.getTime() - now.getTime()) / dayMs));
  const requiredPerDay = remaining / daysLeft;

  const convByClick = new Map(conv7d.map((c) => [c.clickId, c]));
  const byHook = new Map<string, { clicks: number; conv: number; earnings: number }>();
  const byOffer = new Map<string, { clicks: number; conv: number; earnings: number }>();
  const byVideo = new Map<string, { clicks: number; conv: number; earnings: number }>();

  for (const click of clicks7d) {
    const conv = convByClick.get(click.clickId);
    const payout = conv?.payout ?? 0;

    const hook = click.hookType ?? "unknown";
    const offer = click.offerName ?? "unknown";
    const video = click.videoId ?? "unknown";

    for (const [map, key] of [[byHook, hook], [byOffer, offer], [byVideo, video]] as const) {
      const item = map.get(key) ?? { clicks: 0, conv: 0, earnings: 0 };
      item.clicks += 1;
      if (conv) item.conv += 1;
      item.earnings += payout;
      map.set(key, item);
    }
  }

  const hooks = [...byHook.entries()].map(([name, v]) => ({
    hookType: name,
    clicks: v.clicks,
    conversions: v.conv,
    earnings: v.earnings,
    epc: v.clicks ? v.earnings / v.clicks : 0
  }));

  const offers = [...byOffer.entries()].map(([name, v]) => ({
    offerName: name,
    clicks: v.clicks,
    conversions: v.conv,
    earnings: v.earnings,
    epc: v.clicks ? v.earnings / v.clicks : 0
  }));

  const videos = [...byVideo.entries()].map(([name, v]) => {
    const epc = v.clicks ? v.earnings / v.clicks : 0;
    const d = decide(v.clicks, v.conv, epc);
    return {
      videoId: name,
      clicks: v.clicks,
      conversions: v.conv,
      earnings: v.earnings,
      epc,
      decision: d.decision,
      reason: d.reason
    };
  }).sort((a, b) => b.epc - a.epc);

  const bestHook = hooks.sort((a, b) => b.epc - a.epc)[0]?.hookType ?? "n/a";
  const earnings7d = conv7d.reduce((s, c) => s + c.payout, 0);
  const epc7d = clicks7d.length ? earnings7d / clicks7d.length : 0;

  const scaleThese = videos.filter((v) => v.decision === "SCALE").slice(0, 5);
  const killOrFix = videos
    .filter((v) => v.clicks >= 50)
    .map((v) => ({
      ...v,
      action: v.decision === "KILL" ? "Pause immediately, rewrite hook and test new offer angle." : "Keep testing with new intro and CTA."
    }));

  const winners = allClicks.reduce<Record<string, { clicks: number; earnings: number }>>((acc, c) => {
    const key = c.videoId ?? c.hookType ?? c.offerName ?? "unknown";
    const existing = acc[key] ?? { clicks: 0, earnings: 0 };
    existing.clicks += 1;
    const conv = convByClick.get(c.clickId);
    existing.earnings += conv?.payout ?? 0;
    acc[key] = existing;
    return acc;
  }, {});

  const topWinners = Object.entries(winners)
    .map(([name, v]) => ({ name, clicks: v.clicks, epc: v.clicks ? v.earnings / v.clicks : 0 }))
    .sort((a, b) => b.epc - a.epc)
    .slice(0, 5);

  return {
    monthlyGoal: {
      goal: campaign.goalUSD,
      earnings,
      remaining,
      daysLeft,
      requiredPerDay
    },
    kpis: {
      todayClicks,
      todayEarnings: todayConv._sum.payout ?? 0,
      epc7d,
      bestHook7d: bestHook
    },
    scaleThese,
    killOrFix,
    videos,
    hooks,
    offers,
    topWinners
  };
}
