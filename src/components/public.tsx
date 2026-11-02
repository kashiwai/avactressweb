// 公開サイト用の表示部品
import Link from "next/link";
import { Clock, MapPin, Store } from "lucide-react";
import { Avatar, Badge, cn } from "./ui";
import { hm, isWithinShift, shortDate, weekdayIndex } from "@/lib/dates";
import { prefName } from "@/lib/prefectures";
import { GENRE_ACTIVE_CLASSES, GENRE_BADGE_CLASSES, GENRE_CHIP_CLASSES, GENRES, genreColor, genreLabel } from "@/lib/genres";
import type { WorkingRow } from "@/lib/queries";

/** 業種を色分けしたバッジ（ソープ＝赤、デリヘル＝青、チャイデリ＝橙、エステ＝緑…） */
export function GenreBadge({ genre, className }: { genre?: string | null; className?: string }) {
  const label = genreLabel(genre);
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        GENRE_BADGE_CLASSES[genreColor(genre)],
        className,
      )}
    >
      {label}
    </span>
  );
}

/** 業種で絞り込む色付きチップ。makeHref は現在の検索条件を保ったURLを作る */
export function GenreFilter({
  current,
  makeHref,
  className,
}: {
  current?: string;
  makeHref: (genre?: string) => string;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1.5 overflow-x-auto pb-1", className)} role="group" aria-label="業種で絞り込む">
      <Link
        href={makeHref()}
        aria-current={!current ? "true" : undefined}
        className={cn(
          "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
          !current ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted hover:border-rose-500/40 hover:text-foreground",
        )}
      >
        すべて
      </Link>
      {GENRES.map((g) => {
        const active = current === g.name;
        return (
          <Link
            key={g.slug}
            href={makeHref(g.name)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active ? GENRE_ACTIVE_CLASSES[g.color] : GENRE_CHIP_CLASSES[g.color],
            )}
          >
            {g.label}
          </Link>
        );
      })}
    </div>
  );
}

export function WorkingCard({ row, nowHm, isToday }: { row: WorkingRow; nowHm: string; isToday: boolean }) {
  const live = isToday && isWithinShift(row.startTime, row.endTime, nowHm);
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:border-rose-500/40">
      <Link href={`/actresses/${row.actressId}`} className="shrink-0">
        <Avatar name={row.actressName} src={row.imageUrl} size={64} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/actresses/${row.actressId}`} className="truncate font-bold hover:text-accent">
            {row.actressName}
          </Link>
          {live ? <Badge tone="accent">● いま出勤中</Badge> : <Badge tone="ok">出勤</Badge>}
          <GenreBadge genre={row.genre} />
        </div>
        <Link href={`/shops/${row.shopId}`} className="mt-1 flex items-center gap-1 truncate text-sm text-muted hover:text-foreground">
          <Store className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {row.shopName}
            {row.shopDisplayName !== row.actressName && <span className="text-muted/80">（{row.shopDisplayName}）</span>}
          </span>
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1">
            <MapPin className="size-3" aria-hidden />
            {prefName(row.prefCode)}
            {row.area && ` ${row.area}`}
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <Clock className="size-3" aria-hidden />
            {row.startTime ? `${hm(row.startTime)}〜${hm(row.endTime)}` : "時間未定"}
          </span>
        </div>
      </div>
    </div>
  );
}

type CalCell = { status: "working" | "off"; startTime: string | null; endTime: string | null } | undefined;

/** 出勤カレンダー（行＝店舗、列＝日付）。出勤・休み・未定を色分けする */
export function AttendanceGrid({
  dates,
  rows,
  today,
}: {
  dates: string[];
  rows: Array<{ key: string | number; label: React.ReactNode; cells: Map<string, NonNullable<CalCell>> }>;
  today: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-36 bg-surface-2 px-3 py-2 text-left font-semibold text-muted">店舗</th>
            {dates.map((d) => {
              const w = weekdayIndex(d);
              return (
                <th
                  key={d}
                  className={cn(
                    "min-w-14 bg-surface-2 px-1 py-2 text-center font-semibold",
                    w === 0 && "text-rose-700",
                    w === 6 && "text-sky-700",
                    d === today && "bg-accent-soft",
                  )}
                >
                  {shortDate(d)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="sticky left-0 z-10 border-t border-line bg-surface px-3 py-2 font-medium">{r.label}</td>
              {dates.map((d) => {
                const c = r.cells.get(d);
                return (
                  <td key={d} className={cn("border-t border-l border-line px-1 py-2 text-center", d === today && "bg-accent-soft/50")}>
                    {!c ? (
                      <span className="text-muted/60">未定</span>
                    ) : c.status === "working" ? (
                      <span className="block rounded bg-green-50 px-1 py-1 font-semibold text-green-700">
                        出勤
                        {c.startTime && <span className="block font-normal tabular-nums text-green-700">{hm(c.startTime)}〜</span>}
                      </span>
                    ) : (
                      <span className="block rounded bg-surface-2 px-1 py-1 text-muted">休み</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted">
      <span className="flex items-center gap-1">
        <span className="inline-block size-3 rounded bg-green-500/40" />
        出勤
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block size-3 rounded bg-surface-2 ring-1 ring-line" />
        休み
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block size-3 rounded ring-1 ring-line" />
        未定（お店が未発表）
      </span>
    </div>
  );
}

export function PrBadge() {
  return <span className="rounded border border-amber-500/40 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">PR</span>;
}

/** 前へ／次へのページ送り（件数を数えずに「次があるか」だけで判定し、速さを優先） */
export function Pager({ page, hasNext, makeHref }: { page: number; hasNext: boolean; makeHref: (p: number) => string }) {
  if (page <= 1 && !hasNext) return null;
  const cls = "rounded-lg border border-line bg-surface px-4 py-2 text-sm hover:border-accent";
  return (
    <nav className="mt-6 flex items-center justify-center gap-3" aria-label="ページ送り">
      {page > 1 ? <Link href={makeHref(page - 1)} className={cls}>前の60件</Link> : <span />}
      <span className="text-sm text-muted">{page}ページ目</span>
      {hasNext ? <Link href={makeHref(page + 1)} className={cls}>次の60件</Link> : <span />}
    </nav>
  );
}
