import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { listActresses } from "@/lib/queries";
import { PREFECTURES, prefName } from "@/lib/prefectures";
import { PAGE_SIZE } from "@/lib/queries";
import { genreByName, genreLabel } from "@/lib/genres";
import { GenreBadge, GenreFilter, Pager } from "@/components/public";
import { Avatar, Badge, Button, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "女優から探す" };

export default async function ActressesPage({ searchParams }: PageProps<"/actresses">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 50) : "";
  const pref = Number(typeof sp.pref === "string" ? sp.pref : 0) || undefined;
  const rawGenre = typeof sp.genre === "string" ? sp.genre : "";
  const genre = genreByName(rawGenre)?.name;
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const rows = await listActresses({ q: q || undefined, prefCode: pref, genre, page });
  const hasNext = rows.length > PAGE_SIZE;
  const list = rows.slice(0, PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="女優から探す"
        description={`風俗店への在籍が公表されているAV女優・セクシー女優${genre ? `（${genreLabel(genre)}）` : ""}（${(page - 1) * PAGE_SIZE + 1}〜${(page - 1) * PAGE_SIZE + list.length}人目）`}
      />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" method="get">
        {genre && <input type="hidden" name="genre" value={genre} />}
        <label className="sr-only" htmlFor="q">女優名</label>
        <input id="q" name="q" defaultValue={q} placeholder="女優名・よみがなで検索" className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm focus:border-accent focus:outline-none" />
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
      <GenreFilter
        current={genre}
        className="mb-5"
        makeHref={(g) => `/actresses?${new URLSearchParams({ ...(q ? { q } : {}), ...(pref ? { pref: String(pref) } : {}), ...(g ? { genre: g } : {}) })}`}
      />
      {list.length === 0 ? (
        <EmptyState title="該当する女優が見つかりません" description="名前の一部やひらがな、業種を変えてお試しください。" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <Link key={a.id} href={`/actresses/${a.id}`} className="flex gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:border-rose-500/40">
              <Avatar name={a.name} src={a.imageUrl} size={64} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold">{a.name}</span>
                  {a.workingToday && <Badge tone="ok">本日出勤</Badge>}
                </div>
                {a.kana && <div className="text-xs text-muted">{a.kana}</div>}
                <div className="mt-1 flex flex-wrap gap-1">
                  {[...new Set(a.genres)].slice(0, 3).map((g) => <GenreBadge key={g} genre={g} />)}
                </div>
                <div className="mt-1 truncate text-xs text-muted">
                  {[...new Set(a.prefCodes)].map(prefName).join("・")}／在籍 {a.shopCount}店
                </div>
                <div className="truncate text-xs text-muted/80">{a.shopNames.join("、")}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pager
        page={page}
        hasNext={hasNext}
        makeHref={(p) => `/actresses?${new URLSearchParams({ ...(q ? { q } : {}), ...(pref ? { pref: String(pref) } : {}), ...(genre ? { genre } : {}), page: String(p) })}`}
      />
    </div>
  );
}
