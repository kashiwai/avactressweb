import Link from "next/link";
import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { AlertTriangle, CalendarHeart, FileWarning, RefreshCw, Store, Users } from "lucide-react";
import { db } from "@/db";
import { actresses, dataSources, enrollments, ingestRuns, removalRequests, schedules, shops } from "@/db/schema";
import { addDays, dateRange, formatDateTimeJst, shortDate, todayJst } from "@/lib/dates";
import { reverifyEnrollment } from "@/lib/actions/admin";
import { WorkingForecastChart } from "@/components/charts";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const today = todayJst();
  const staleBefore = addDays(today, -30);

  const [
    [actressN],
    [shopN],
    [enrN],
    forecastRows,
    newRemovals,
    recentRuns,
    stale,
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(actresses),
    db.select({ n: sql<number>`count(*)::int` }).from(shops),
    db.select({ n: sql<number>`count(*)::int` }).from(enrollments).where(eq(enrollments.status, "active")),
    db
      .select({ d: schedules.workDate, n: sql<number>`count(distinct ${enrollments.actressId})::int` })
      .from(schedules)
      .innerJoin(enrollments, eq(enrollments.id, schedules.enrollmentId))
      .where(and(eq(schedules.status, "working"), eq(enrollments.status, "active"), gte(schedules.workDate, today), lte(schedules.workDate, addDays(today, 13))))
      .groupBy(schedules.workDate),
    db.select().from(removalRequests).where(eq(removalRequests.status, "new")).orderBy(desc(removalRequests.createdAt)).limit(5),
    db
      .select({ run: ingestRuns, sourceName: dataSources.name })
      .from(ingestRuns)
      .innerJoin(dataSources, eq(dataSources.id, ingestRuns.sourceId))
      .orderBy(desc(ingestRuns.startedAt))
      .limit(6),
    db
      .select({ id: enrollments.id, verifiedAt: enrollments.verifiedAt, actressName: actresses.name, shopName: shops.name })
      .from(enrollments)
      .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
      .innerJoin(shops, eq(shops.id, enrollments.shopId))
      .where(and(eq(enrollments.status, "active"), lt(enrollments.verifiedAt, staleBefore)))
      .orderBy(enrollments.verifiedAt)
      .limit(8),
  ]);

  const byDate = new Map(forecastRows.map((r) => [r.d, r.n]));
  const forecast = dateRange(today, 14).map((d) => ({ label: shortDate(d), count: byDate.get(d) ?? 0 }));
  const unmatched = [...new Set(recentRuns.flatMap((r) => r.run.unmatchedNames))];

  return (
    <div className="space-y-6">
      <PageHeader title="ダッシュボード" description={`${shortDate(today)} 時点の掲載状況と、対応が必要な項目`} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="本日の出勤" value={`${forecast[0].count}人`} icon={CalendarHeart} href="/admin/enrollments" />
        <StatCard label="女優" value={`${actressN.n}人`} icon={Users} href="/admin/actresses" />
        <StatCard label="店舗" value={`${shopN.n}店`} icon={Store} href="/admin/shops" />
        <StatCard label="在籍中" value={`${enrN.n}件`} icon={RefreshCw} href="/admin/enrollments" />
      </section>

      <Card className="p-4">
        <h2 className="mb-2 font-bold">今後14日の出勤予定人数</h2>
        <WorkingForecastChart data={forecast} />
        {forecast.slice(7).every((f) => f.count === 0) && <p className="mt-2 text-xs text-amber-700">来週以降の出勤がまだ入っていません。お店への入力依頼か、取り込み元の登録をおすすめします。</p>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <FileWarning className="size-4 text-accent" aria-hidden />
            未対応の削除依頼
          </h2>
          {newRemovals.length === 0 ? (
            <p className="text-sm text-muted">未対応の依頼はありません。</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {newRemovals.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <Link prefetch={false} href={`/admin/removals/${r.id}`} className="truncate hover:text-accent">
                    {r.targetText}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">{formatDateTimeJst(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <AlertTriangle className="size-4 text-amber-400" aria-hidden />
            取り込みで照合できなかった名前
          </h2>
          {unmatched.length === 0 ? (
            <p className="text-sm text-muted">直近の取り込みでは、すべて照合できています。</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {unmatched.map((n) => (
                  <Badge key={n} tone="warn">{n}</Badge>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">お店がAV女優として公表しているか確認のうえ、該当する場合は在籍を登録してください（源氏名を完全一致させると次回から反映されます）。</p>
              <Link prefetch={false} href="/admin/enrollments/new" className="mt-2 inline-block text-sm text-accent underline">在籍を登録する</Link>
            </>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-bold">根拠の再確認が必要な在籍（30日以上未確認）</h2>
          {stale.length === 0 ? (
            <p className="text-sm text-muted">すべて30日以内に確認済みです。</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {stale.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <Link prefetch={false} href={`/admin/enrollments/${s.id}`} className="min-w-0 truncate hover:text-accent">
                    {s.actressName}／{s.shopName}
                    <span className="ml-2 text-xs text-muted">{s.verifiedAt}</span>
                  </Link>
                  <form action={reverifyEnrollment}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="back" value="/admin" />
                    <SubmitButton variant="secondary" className="px-2 py-1 text-xs">確認済みにする</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-bold">直近の取り込み結果</h2>
          {recentRuns.length === 0 ? (
            <EmptyState title="まだ取り込みを実行していません" action={<Link prefetch={false} href="/admin/sources" className="text-sm text-accent underline">取り込み元を見る</Link>} />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {recentRuns.map(({ run, sourceName }) => (
                <li key={run.id} className="flex items-center justify-between gap-2 py-2">
                  <Link prefetch={false} href={`/admin/sources/${run.sourceId}`} className="truncate hover:text-accent">{sourceName}</Link>
                  <span className="flex shrink-0 items-center gap-2">
                    {run.ok ? <Badge tone="ok">{run.appliedCount}件反映</Badge> : <Badge tone="warn">失敗</Badge>}
                    <span className="text-xs text-muted">{formatDateTimeJst(run.startedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
