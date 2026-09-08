export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { buildDashboard } from "@/lib/analytics";
import { getOrCreateCurrentCampaign } from "@/lib/campaign";

function Badge({ decision }: { decision: string }) {
  const cn = decision === "SCALE" ? "badge badge-scale" : decision === "KILL" ? "badge badge-kill" : "badge badge-test";
  return <span className={cn}>{decision}</span>;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const current = await getOrCreateCurrentCampaign();
  const selectedId = (await searchParams).campaign ?? current.id;

  const campaigns = await prisma.campaign.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }], take: 12 });
  const data = await buildDashboard(selectedId, "7d");

  return (
    <main className="grid" style={{ gap: "1rem" }}>
      <h1>CPA Tracker Hub</h1>
      <section className="card grid grid-2">
        <div><strong>Monthly Target</strong><div>${data.monthlyGoal.goal.toFixed(2)}</div></div>
        <div><strong>Earnings</strong><div>${data.monthlyGoal.earnings.toFixed(2)}</div></div>
        <div><strong>Remaining</strong><div>${data.monthlyGoal.remaining.toFixed(2)}</div></div>
        <div><strong>Days Left</strong><div>{data.monthlyGoal.daysLeft}</div></div>
        <div><strong>Required/Day</strong><div>${data.monthlyGoal.requiredPerDay.toFixed(2)}</div></div>
        <form action="/dashboard">
          <strong>Campaign</strong>
          <select name="campaign" defaultValue={selectedId}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button type="submit" style={{ marginTop: ".5rem" }}>Switch</button>
        </form>
      </section>

      <section className="card grid grid-2">
        <div><strong>Today Clicks</strong><div>{data.kpis.todayClicks}</div></div>
        <div><strong>Today Earnings</strong><div>${data.kpis.todayEarnings.toFixed(2)}</div></div>
        <div><strong>EPC 7d</strong><div>${data.kpis.epc7d.toFixed(3)}</div></div>
        <div><strong>Best Hook 7d</strong><div>{data.kpis.bestHook7d}</div></div>
      </section>

      <section className="card">
        <h2>Scale These</h2>
        <ul>{data.scaleThese.map((v) => <li key={v.videoId}>{v.videoId} - EPC ${v.epc.toFixed(3)} ({v.reason})</li>)}</ul>
      </section>

      <section className="card">
        <h2>Kill / Fix</h2>
        <ul>{data.killOrFix.map((v) => <li key={v.videoId}>{v.videoId} - {v.action}</li>)}</ul>
      </section>

      <section className="card">
        <h2>Videos</h2>
        <table className="table">
          <thead><tr><th>Video</th><th>Clicks</th><th>Conv</th><th>Earnings</th><th>EPC</th><th>Decision</th><th>Reason</th></tr></thead>
          <tbody>
            {data.videos.map((v) => (
              <tr key={v.videoId}><td>{v.videoId}</td><td>{v.clicks}</td><td>{v.conversions}</td><td>${v.earnings.toFixed(2)}</td><td>${v.epc.toFixed(3)}</td><td><Badge decision={v.decision} /></td><td>{v.reason}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card grid grid-2">
        <div>
          <h2>Hook analytics</h2>
          <ul>{data.hooks.map((h) => <li key={h.hookType}>{h.hookType}: {h.clicks} clicks / EPC ${h.epc.toFixed(3)}</li>)}</ul>
        </div>
        <div>
          <h2>Offer breakdown</h2>
          <ul>{data.offers.map((o) => <li key={o.offerName}>{o.offerName}: {o.clicks} clicks / EPC ${o.epc.toFixed(3)}</li>)}</ul>
        </div>
      </section>
    </main>
  );
}
