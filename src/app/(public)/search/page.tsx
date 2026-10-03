import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Store } from "lucide-react";
import { siteSearch } from "@/lib/search";
import { getWorkingOn } from "@/lib/queries";
import { nowTimeJst, todayJst } from "@/lib/dates";
import { WorkingCard } from "@/components/public";
import { SearchBox } from "@/components/search-box";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "検索結果", robots: { index: false } };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 50) : "";
  const [r, working] = q ? await Promise.all([siteSearch(q, 50), getWorkingOn(todayJst(), { q })]) : [null, []];
  const total = r ? r.actresses.length + r.shops.length + r.areas.length : 0;

  return (
    <div className="space-y-6">
      <PageHeader title={q ? `「${q}」の検索結果` : "検索"} description={q ? `${total}件` : "女優名・店舗名・地域で探せます"} />
      <div className="max-w-xl sm:hidden">
        <SearchBox />
      </div>
      {!q || !r ? null : total === 0 && working.length === 0 ? (
        <EmptyState title="見つかりませんでした" description="名前の一部だけ、またはひらがなでもお試しください。" />
      ) : (
        <>
          {r.areas.length > 0 && (
            <section className="flex flex-wrap gap-2">
              {r.areas.map((a) => (
                <Link key={a.href} href={a.href} className="flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent">
                  <MapPin className="size-4 text-accent" aria-hidden />
                  {a.label}
                </Link>
              ))}
            </section>
          )}
          {working.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">本日出勤</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {working.map((w) => <WorkingCard key={`${w.actressId}-${w.shopId}`} row={w} nowHm={nowTimeJst()} isToday />)}
              </div>
            </section>
          )}
          {r.actresses.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">女優</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {r.actresses.map((a) => (
                  <Link key={a.id} href={`/actresses/${a.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-accent">
                    <Avatar name={a.name} src={a.imageUrl} size={44} />
                    <span><span className="block font-bold">{a.name}</span><span className="text-xs text-muted">{a.kana}</span></span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {r.shops.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">店舗</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {r.shops.map((s) => (
                  <Link key={s.id} href={`/shops/${s.id}`} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3 hover:border-accent">
                    <Store className="size-4 text-accent" aria-hidden />
                    <span><span className="block font-bold">{s.name}</span><span className="text-xs text-muted">{s.pref} {s.area}・{s.genre}</span></span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
