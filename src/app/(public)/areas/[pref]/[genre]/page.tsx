import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getWorkingOn, listPublicShops } from "@/lib/queries";
import { dateRange, isYmd, nowTimeJst, shortDate, todayJst } from "@/lib/dates";
import { prefBySlug } from "@/lib/prefectures";
import { genreBySlug } from "@/lib/genres";
import { WorkingCard } from "@/components/public";
import { Badge, EmptyState, PageHeader, cn } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/areas/[pref]/[genre]">): Promise<Metadata> {
  const { pref, genre } = await params;
  const p = prefBySlug(pref);
  const g = genreBySlug(genre);
  return { title: p && g ? `${p.name}の${g.name}に出勤するAV女優` : "ページが見つかりません" };
}

export default async function AreaGenrePage({ params, searchParams }: PageProps<"/areas/[pref]/[genre]">) {
  const { pref: ps, genre: gs } = await params;
  const pref = prefBySlug(ps);
  const genre = genreBySlug(gs);
  if (!pref || !genre) notFound();
  const sp = await searchParams;
  const today = todayJst();
  const days = dateRange(today, 7);
  const raw = typeof sp.date === "string" ? sp.date : "";
  const date = isYmd(raw) && days.includes(raw) ? raw : today;
  const [rows, shopList] = await Promise.all([
    getWorkingOn(date, { prefCode: pref.code, genre: genre.name }),
    listPublicShops({ prefCode: pref.code, genre: genre.name }),
  ]);
  const base = `/areas/${pref.slug}/${genre.slug}`;

  return (
    <div className="space-y-6">
      <nav className="text-xs text-muted" aria-label="パンくず">
        <Link href="/" className="hover:text-foreground">トップ</Link> ／ <Link href="/areas" className="hover:text-foreground">地域から探す</Link> ／{" "}
        <Link href={`/areas/${pref.slug}`} className="hover:text-foreground">{pref.name}</Link> ／ {genre.label}
      </nav>
      <PageHeader
        title={`${pref.name}の${genre.label}に出勤するAV女優`}
        description={`${date === today ? "本日" : shortDate(date)}の出勤 ${new Set(rows.map((r) => r.actressId)).size}人／掲載店舗 ${shopList.length}店`}
      />
      <div className="flex gap-1 overflow-x-auto pb-1">
        {days.map((d, i) => (
          <Link key={d} href={d === today ? base : `${base}?date=${d}`} className={cn("whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm", d === date ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted hover:text-foreground")}>
            {i === 0 ? "今日" : i === 1 ? "明日" : shortDate(d)}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title={`${pref.name}の${genre.label}で出勤予定のAV女優はいません`} description="別の日付か業種をお選びください。" action={<Link href={`/areas/${pref.slug}`} className="text-sm text-accent underline">{pref.name}のすべての業種を見る</Link>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => <WorkingCard key={`${r.actressId}-${r.shopId}`} row={r} nowHm={nowTimeJst()} isToday={date === today} />)}
        </div>
      )}
      {shopList.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">{pref.name}の{genre.label}（掲載店舗）</h2>
          <div className="flex flex-wrap gap-2">
            {shopList.map(({ shop, workingToday }) => (
              <Link key={shop.id} href={`/shops/${shop.id}`} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-rose-500/40">
                {shop.name}{workingToday > 0 && <Badge tone="ok">{workingToday}人</Badge>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
