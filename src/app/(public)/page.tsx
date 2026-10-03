import Link from "next/link";
import { CalendarHeart, RefreshCw, Search, Store, Users } from "lucide-react";
import { getRecentEnrollments, getSiteStats, getWorkingCountByPref, getWorkingOn } from "@/lib/queries";
import { addDays, dateRange, formatDateTimeJst, isYmd, nowTimeJst, shortDate, todayJst } from "@/lib/dates";
import { PREFECTURES, REGIONS, prefName } from "@/lib/prefectures";
import { WorkingCard } from "@/components/public";
import { Avatar, Button, Card, EmptyState, StatCard, cn } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const today = todayJst();
  const days = dateRange(today, 7);
  const rawDate = typeof sp.date === "string" ? sp.date : "";
  const date = isYmd(rawDate) && days.includes(rawDate) ? rawDate : today;
  const pref = Number(typeof sp.pref === "string" ? sp.pref : 0) || undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 50) : "";

  const [rows, stats, prefCounts, recent] = await Promise.all([
    getWorkingOn(date, { prefCode: pref, q: q || undefined }),
    getSiteStats(),
    getWorkingCountByPref(date),
    getRecentEnrollments(6),
  ]);
  const nowHm = nowTimeJst();
  const isToday = date === today;
  const liveCount = new Set(rows.map((r) => r.actressId)).size;

  const qs = (d: string) => {
    const p = new URLSearchParams();
    if (d !== today) p.set("date", d);
    if (pref) p.set("pref", String(pref));
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-line bg-gradient-to-br from-rose-50 via-white to-white p-5 sm:p-7">
        <h1 className="text-2xl font-bold sm:text-3xl">
          AV女優・セクシー女優の<span className="text-accent">風俗出勤情報</span>
        </h1>
        <p className="mt-2 text-sm text-muted">お店が公表している在籍・出勤予定を毎日集計。女優・店舗・地域から今日の出勤がすぐに分かります。</p>
        <form className="mt-5 flex flex-col gap-2 sm:flex-row" action="/" method="get">
          {date !== today && <input type="hidden" name="date" value={date} />}
          <label className="sr-only" htmlFor="q">キーワード</label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="女優名・店舗名・エリアで検索"
            className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
          />
          <label className="sr-only" htmlFor="pref">都道府県</label>
          <select id="pref" name="pref" defaultValue={pref ?? ""} className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm">
            <option value="">全国</option>
            {PREFECTURES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          <Button type="submit" className="py-2.5">
            <Search className="size-4" aria-hidden />
            検索
          </Button>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="本日の出勤" value={`${stats.workingToday}人`} icon={CalendarHeart} />
        <StatCard label="掲載中の女優" value={`${stats.actressCount}人`} icon={Users} href="/actresses" />
        <StatCard label="掲載店舗" value={`${stats.shopCount}店`} icon={Store} href="/shops" />
        <StatCard label="最終更新" value={<span className="text-base">{formatDateTimeJst(stats.lastUpdated)}</span>} icon={RefreshCw} />
      </section>

      <section>
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="日付を選ぶ">
          {days.map((d, i) => (
            <Link
              key={d}
              href={qs(d)}
              role="tab"
              aria-selected={d === date}
              className={cn(
                "whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm",
                d === date ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted hover:text-foreground",
              )}
            >
              {i === 0 ? "今日" : i === 1 ? "明日" : shortDate(d)}
            </Link>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">
            {isToday ? "本日" : shortDate(date)}出勤のAV女優
            {pref && <span className="ml-2 text-base text-muted">／{prefName(pref)}</span>}
            <span className="ml-2 text-base font-normal text-muted">{liveCount}人</span>
          </h2>
          {(pref || q) && (
            <Link href={date === today ? "/" : `/?date=${date}`} className="text-sm text-muted underline hover:text-foreground">
              絞り込みを解除
            </Link>
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="該当する出勤情報はありません"
            description="条件を変えるか、別の日付をお選びください。出勤予定はお店の発表に合わせて毎日更新しています。"
            action={
              <Link href="/actresses" className="text-sm text-accent underline">
                女優一覧を見る
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <WorkingCard key={`${r.actressId}-${r.shopId}`} row={r} nowHm={nowHm} isToday={isToday} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-bold">地域別の{isToday ? "本日" : shortDate(date)}出勤</h2>
          <Card className="divide-y divide-line">
            {REGIONS.map((region) => (
              <div key={region} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="w-28 shrink-0 text-sm font-semibold text-muted">{region}</div>
                <div className="flex flex-wrap gap-1.5">
                  {PREFECTURES.filter((p) => p.region === region).map((p) => {
                    const n = prefCounts.get(p.code) ?? 0;
                    return (
                      <Link
                        key={p.code}
                        href={`/areas/${p.slug}${date !== today ? `?date=${date}` : ""}`}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs",
                          n > 0 ? "border-rose-500/40 bg-accent-soft text-rose-700 hover:bg-rose-100" : "border-line text-muted hover:text-foreground",
                        )}
                      >
                        {p.name.replace(/[都府県]$/, "")}
                        {n > 0 && <span className="ml-1 font-bold">{n}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </Card>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-bold">新着の在籍情報</h2>
          {recent.length === 0 ? (
            <EmptyState title="まだ在籍情報がありません" />
          ) : (
            <Card className="divide-y divide-line">
              {recent.map((r) => (
                <Link key={`${r.actressId}-${r.shopId}`} href={`/actresses/${r.actressId}`} className="flex items-center gap-3 p-3 hover:bg-surface-2">
                  <Avatar name={r.actressName} src={r.imageUrl} size={40} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{r.actressName}</div>
                    <div className="truncate text-xs text-muted">
                      {prefName(r.prefCode)}・{r.shopName}
                    </div>
                  </div>
                </Link>
              ))}
            </Card>
          )}
          <p className="mt-3 text-xs text-muted">
            出勤予定は{shortDate(today)}〜{shortDate(addDays(today, 6))}の7日分を表示しています。
          </p>
        </div>
      </section>
    </div>
  );
}
