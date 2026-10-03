import Link from "next/link";
import type { Metadata } from "next";
import { Search, Store } from "lucide-react";
import { listPublicShops } from "@/lib/queries";
import { PREFECTURES, prefName } from "@/lib/prefectures";
import { PAGE_SIZE } from "@/lib/queries";
import { Pager } from "@/components/public";
import { Badge, Button, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "店舗から探す" };

export default async function ShopsPage({ searchParams }: PageProps<"/shops">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 50) : "";
  const pref = Number(typeof sp.pref === "string" ? sp.pref : 0) || undefined;
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const rows = await listPublicShops({ prefCode: pref, q: q || undefined, page });
  const hasNext = rows.length > PAGE_SIZE;
  const list = rows.slice(0, PAGE_SIZE);

  return (
    <div>
      <PageHeader title="店舗から探す" description={`AV女優の在籍を公表している店舗（${(page - 1) * PAGE_SIZE + 1}〜${(page - 1) * PAGE_SIZE + list.length}店目）`} />
      <form className="mb-5 flex flex-col gap-2 sm:flex-row" method="get">
        <label className="sr-only" htmlFor="q">店舗名</label>
        <input id="q" name="q" defaultValue={q} placeholder="店舗名・エリア・業種で検索" className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm focus:border-accent focus:outline-none" />
        <label className="sr-only" htmlFor="pref">都道府県</label>
        <select id="pref" name="pref" defaultValue={pref ?? ""} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          <option value="">全国</option>
          {PREFECTURES.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
        <Button type="submit">
          <Search className="size-4" aria-hidden />
          検索
        </Button>
      </form>
      {list.length === 0 ? (
        <EmptyState title="該当する店舗が見つかりません" description="都道府県やキーワードを変えてお試しください。" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map(({ shop, avCount, workingToday }) => (
            <Link key={shop.id} href={`/shops/${shop.id}`} className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-rose-500/40">
              <div className="flex items-center gap-2 font-bold">
                <Store className="size-4 text-accent" aria-hidden />
                {shop.name}
              </div>
              <div className="mt-1 text-sm text-muted">
                {prefName(shop.prefCode)} {shop.area}
                {shop.genre && `／${shop.genre}`}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="info">AV女優在籍 {avCount + shop.anonymousAvCount}人</Badge>
                {workingToday > 0 ? <Badge tone="ok">本日出勤 {workingToday}人</Badge> : <Badge>本日出勤なし</Badge>}
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pager
        page={page}
        hasNext={hasNext}
        makeHref={(p) => `/shops?${new URLSearchParams({ ...(q ? { q } : {}), ...(pref ? { pref: String(pref) } : {}), page: String(p) })}`}
      />
    </div>
  );
}
