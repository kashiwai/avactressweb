import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getWorkingOn, listPublicShops } from "@/lib/queries";
import { dateRange, isYmd, nowTimeJst, shortDate, todayJst } from "@/lib/dates";
import { prefBySlug } from "@/lib/prefectures";
import { genreByName, GENRE_CHIP_CLASSES, genreColor } from "@/lib/genres";
import { GenreBadge, WorkingCard } from "@/components/public";
import { Badge, EmptyState, PageHeader, cn } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/areas/[pref]">): Promise<Metadata> {
  const p = prefBySlug((await params).pref);
  return { title: p ? `${p.name}のAV女優 風俗出勤情報` : "地域が見つかりません" };
}

export default async function AreaPage({ params, searchParams }: PageProps<"/areas/[pref]">) {
  const pref = prefBySlug((await params).pref);
  if (!pref) notFound();
  const sp = await searchParams;
  const today = todayJst();
  const days = dateRange(today, 7);
  const raw = typeof sp.date === "string" ? sp.date : "";
  const date = isYmd(raw) && days.includes(raw) ? raw : today;
  const [rows, shopList] = await Promise.all([getWorkingOn(date, { prefCode: pref.code }), listPublicShops({ prefCode: pref.code })]);
  const nowHm = nowTimeJst();

  return (
    <div className="space-y-6">
      <nav className="text-xs text-muted" aria-label="パンくず">
        <Link href="/" className="hover:text-foreground">トップ</Link> ／ <Link href="/areas" className="hover:text-foreground">地域から探す</Link> ／ {pref.name}
      </nav>
      <PageHeader title={`${pref.name}のAV女優 出勤情報`} description={`${date === today ? "本日" : shortDate(date)}の出勤 ${new Set(rows.map((r) => r.actressId)).size}人／掲載店舗 ${shopList.length}店`} />
      {shopList.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="業種で絞り込む">
          {[...new Set(shopList.map(({ shop }) => shop.genre))].map((name) => {
            const g = genreByName(name);
            return g ? (
              <Link key={g.slug} href={`/areas/${pref.slug}/${g.slug}`} className={cn("rounded-full border px-3 py-1 text-sm font-medium", GENRE_CHIP_CLASSES[genreColor(g.name)])}>
                {pref.name.replace(/[都府県]$/, "")}の{g.label}
              </Link>
            ) : null;
          })}
        </div>
      )}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {days.map((d, i) => (
          <Link
            key={d}
            href={d === today ? `/areas/${pref.slug}` : `/areas/${pref.slug}?date=${d}`}
            className={cn("whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm", d === date ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted hover:text-foreground")}
          >
            {i === 0 ? "今日" : i === 1 ? "明日" : shortDate(d)}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title={`${pref.name}で出勤予定のAV女優はいません`} description="別の日付か、近くの地域をお選びください。" action={<Link href="/areas" className="text-sm text-accent underline">地域一覧へ戻る</Link>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <WorkingCard key={`${r.actressId}-${r.shopId}`} row={r} nowHm={nowHm} isToday={date === today} />
          ))}
        </div>
      )}
      {shopList.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">{pref.name}の掲載店舗</h2>
          <div className="flex flex-wrap gap-2">
            {shopList.map(({ shop, workingToday }) => (
              <Link key={shop.id} href={`/shops/${shop.id}`} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-rose-500/40">
                {shop.name}
                <GenreBadge genre={shop.genre} />
                {workingToday > 0 && <Badge tone="ok">{workingToday}人</Badge>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
