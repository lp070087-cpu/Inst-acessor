import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { withAdminApi } from "@/lib/auth/admin-api";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
const select = { id: true, name: true, email: true, whatsapp: true, planSlug: true, source: true, status: true, emailConsent: true, whatsappConsent: true, createdAt: true, verifiedAt: true } as const;
const quote = (value: unknown) => {
  const raw = String(value ?? "");
  return `"${(/^[=+@\-\t\r]/.test(raw) ? "'" : "") + raw.replace(/"/g, '""')}"`;
};
const handler = withAdminApi(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const planSlug = params.get("planSlug");
  const status = params.get("status");
  const source = params.get("source");
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  const where: Prisma.LaunchSubscriberWhereInput = {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { whatsapp: { contains: q } }] } : {}),
    ...(["semanal", "mensal", "anual"].includes(planSlug ?? "") ? { planSlug: planSlug! } : {}),
    ...(["PENDING", "VERIFIED", "UNSUBSCRIBED"].includes(status ?? "") ? { status: status! } : {}),
    ...(["landing", "landing-plan"].includes(source ?? "") ? { source: source! } : {}),
  };
  const orderBy = { createdAt: params.get("sort") === "oldest" ? "asc" as const : "desc" as const };
  if (params.get("format") === "csv") {
    const rows = await prisma.launchSubscriber.findMany({ where, select, orderBy, take: 1000 });
    const columns = ["name", "email", "whatsapp", "planSlug", "source", "status", "emailConsent", "whatsappConsent", "createdAt"] as const;
    const csv = [columns.map(quote).join(","), ...rows.map((row) => columns.map((key) => quote(row[key] instanceof Date ? (row[key] as Date).toISOString() : row[key])).join(","))].join("\r\n");
    return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="lista-espera.csv"', "X-Export-Limit": "1000" } });
  }
  // Global counters, independent of filters; UTC day is explicit in the DTO.
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const since = new Date(today.getTime() - 29 * 86_400_000);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const [items, total, all, todayCount, plans, sources, statuses, emailConsent, whatsappConsent, campaigns, dailyRows, notifications] = await Promise.all([
    prisma.launchSubscriber.findMany({ where, select, orderBy, skip: (page - 1) * 25, take: 25 }),
    prisma.launchSubscriber.count({ where }), prisma.launchSubscriber.count(), prisma.launchSubscriber.count({ where: { createdAt: { gte: today } } }),
    prisma.launchSubscriber.groupBy({ by: ["planSlug"], _count: { _all: true } }),
    prisma.launchSubscriber.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.launchSubscriber.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.launchSubscriber.count({ where: { emailConsent: true } }), prisma.launchSubscriber.count({ where: { whatsappConsent: true } }),
    prisma.launchCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id: true, key: true, status: true, createdAt: true, _count: { select: { notifications: true } } } }),
    prisma.$queryRaw<Array<{ day: string; count: number }>>`SELECT to_char("createdAt", 'YYYY-MM-DD') AS "day", COUNT(*)::integer AS "count"
      FROM "LaunchSubscriber" WHERE "createdAt" >= ${since} AND "createdAt" < ${tomorrow}
      GROUP BY to_char("createdAt", 'YYYY-MM-DD') ORDER BY "day" ASC LIMIT 30`,
    prisma.launchNotification.groupBy({ by: ["channel", "status"], where: {
      channel: { in: ["EMAIL", "WHATSAPP"] }, status: { in: ["HELD", "READY", "PROCESSING", "SENT", "UNCERTAIN", "CANCELLED"] },
    }, _count: { _all: true } }),
  ]);
  const dailyCounts = new Map(dailyRows.map((row) => [row.day, row.count]));
  const recentDays = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(since.getTime() + index * 86_400_000).toISOString().slice(0, 10);
    return { day, count: dailyCounts.get(day) ?? 0 };
  });
  return NextResponse.json({ items, page, pageSize: 25, total, counters: { total: all, today: todayCount, dayTimezone: "UTC",
    byPlan: plans.map((row) => ({ planSlug: row.planSlug, count: row._count._all })), bySource: sources.map((row) => ({ source: row.source, count: row._count._all })),
    byStatus: statuses.map((row) => ({ status: row.status, count: row._count._all })), emailConsent, whatsappConsent },
    recentDays, notificationCounts: notifications.map((row) => ({ channel: row.channel, status: row.status, count: row._count._all })),
    campaigns: campaigns.map(({ _count, ...campaign }) => ({ ...campaign, notificationCount: _count.notifications })) });
});
export async function GET(request: Request) {
  try { const response = await handler(request); response.headers.set("Cache-Control", "no-store"); return response; }
  catch { return NextResponse.json({ error: "Não foi possível carregar a lista." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
