import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarCheck, ExternalLink, Sparkles, Store, TrendingUp } from "lucide-react";
import { getPublicActress } from "@/lib/queries";
import { fetchActressItems } from "@/lib/dmm";
import { fetchDugaWorks } from "@/lib/duga";
import { WEEKDAY_LABELS, addDays, dateRange, hm, shortDate, todayJst } from "@/lib/dates";
import { prefName } from "@/lib/prefectures";
import { AttendanceGrid, Legend, PrBadge } from "@/components/public";
import { Avatar, Badge, Card, cn } from "@/components/ui";

export const dynamic = "force-dynamic";

async function load(idStr: string) {
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return null;
  return getPublicActress(id);
}

export async function generateMetadata({ params }: PageProps<"/actresses/[id]">): Promise<Metadata> {
  const data = await load((await params).id);
  if (!data) return { title: "女優が見つかりません" };
  return {
    title: `${data.actress.name}の風俗出勤情報`,
    description: `${data.actress.name}の在籍店舗と出勤日・休みの予定。`,
  };
}

export default async function ActressDetailPage({ params }: PageProps<"/actresses/[id]">) {
  const data = await load((await params).id);
  if (!data) notFound();
  const { actress, enrollments, schedules, links, insight } = data;
  const today = todayJst();
  const dates = dateRange(addDays(today, -7), 38);
  const [items, dugaItems] = await Promise.all([
    actress.dmmActressId ? fetchActressItems(actress.dmmActressId) : Promise.resolve([]),
    actress.dugaPerformerId ? fetchDugaWorks(actress.name, actress.dugaPerformerId) : Promise.resolve([]),
  ]);

  const rows = enrollments.map((e) => ({
    key: e.enrollmentId,
    label: (
      <Link href={`/shops/${e.shop.id}`} className="hover:text-accent">
        {e.shop.name}
        <span className="block text-[11px] font-normal text-muted">{prefName(e.shop.prefCode)} {e.shop.area}</span>
      </Link>
    ),
    cells: new Map(
      schedules.filter((s) => s.enrollmentId === e.enrollmentId).map((s) => [s.workDate, { status: s.status, startTime: s.startTime, endTime: s.endTime }]),
    ),
  }));

  const todayRows = schedules.filter((s) => s.workDate === today && s.status === "working");
  const maxW = Math.max(1, ...insight.byWeekday);

  return (
    <div className="space-y-6">
      <nav className="text-xs text-muted" aria-label="パンくず">
        <Link href="/" className="hover:text-foreground">トップ</Link> ／ <Link href="/actresses" className="hover:text-foreground">女優から探す</Link> ／ {actress.name}
      </nav>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row">
        <Avatar name={actress.name} src={actress.imageUrl} size={128} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{actress.name}</h1>
          {actress.kana && <p className="text-sm text-muted">{actress.kana}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {todayRows.length > 0 ? <Badge tone="ok">本日出勤</Badge> : <Badge>本日の出勤予定なし</Badge>}
            <Badge tone="info">在籍 {enrollments.length}店</Badge>
          </div>
          {actress.profile && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{actress.profile}</p>}
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted"><CalendarCheck className="size-4" aria-hidden />次の出勤日</div>
          <div className="mt-2 text-xl font-bold">{insight.nextWorkDate ? (insight.nextWorkDate === today ? "今日" : shortDate(insight.nextWorkDate)) : "未発表"}</div>
          <div className="mt-1 text-xs text-muted">今後30日の出勤予定 {insight.upcomingDays}日</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted"><TrendingUp className="size-4" aria-hidden />よく出勤する曜日</div>
          <div className="mt-2 text-xl font-bold">{insight.topWeekdays.length ? insight.topWeekdays.map((i) => WEEKDAY_LABELS[i]).join("・") + "曜" : "データ不足"}</div>
          <div className="mt-1 text-xs text-muted">直近90日で{insight.workedDays90}日出勤</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted">曜日別の出勤回数（直近90日）</div>
          <div className="mt-2 flex h-14 items-end gap-1.5" aria-label="曜日別の出勤回数">
            {insight.byWeekday.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className={cn("w-full rounded-sm", insight.topWeekdays.includes(i) ? "bg-accent" : "bg-rose-200")} style={{ height: `${Math.max(4, (n / maxW) * 40)}px` }} title={`${WEEKDAY_LABELS[i]}曜 ${n}回`} />
                <span className="text-[10px] text-muted">{WEEKDAY_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold">出勤カレンダー</h2>
          <Legend />
        </div>
        {rows.length === 0 ? (
          <Card className="p-6 text-sm text-muted">現在、在籍が公表されている店舗はありません。</Card>
        ) : (
          <AttendanceGrid dates={dates} rows={rows} today={today} />
        )}
        <p className="mt-2 text-xs text-muted">出勤予定はお店の都合で変わることがあります。ご来店前に必ずお店へご確認ください。</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">在籍店舗</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {enrollments.map((e) => {
            const t = todayRows.find((s) => s.enrollmentId === e.enrollmentId);
            return (
              <Card key={e.enrollmentId} className="p-4">
                <Link href={`/shops/${e.shop.id}`} className="flex items-center gap-2 font-bold hover:text-accent">
                  <Store className="size-4" aria-hidden />
                  {e.shop.name}
                </Link>
                <div className="mt-1 text-sm text-muted">
                  {prefName(e.shop.prefCode)} {e.shop.area}／{e.shop.genre}
                </div>
                <div className="mt-1 text-sm">店での名前：{e.shopDisplayName}</div>
                <div className="mt-2 text-sm">{t ? <Badge tone="ok">本日 {t.startTime ? `${hm(t.startTime)}〜${hm(t.endTime)}` : "出勤"}</Badge> : <Badge>本日出勤なし</Badge>}</div>
                <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-flex items-center gap-1 text-xs text-muted underline hover:text-foreground">
                  在籍の公表元（{e.verifiedAt.replace(/-/g, "/")} 確認）
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </Card>
            );
          })}
        </div>
      </section>

      {links.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            {actress.name}の公式コンテンツ <PrBadge />
          </h2>
          <div className="flex flex-wrap gap-2">
            {links.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="sponsored nofollow noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm hover:border-rose-500/40">
                <Sparkles className="size-4 text-accent" aria-hidden />
                {l.label}
                <span className="text-xs text-muted">（{l.provider === "myfans" ? "myfans" : l.provider === "fanza" ? "FANZA" : "外部サイト"}）</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {items.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            {actress.name}の最新作品 <PrBadge />
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((it) => (
              <a key={it.contentId} href={it.affiliateUrl} target="_blank" rel="sponsored nofollow noopener" className="group overflow-hidden rounded-xl border border-line bg-surface hover:border-rose-500/40">
                {it.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.imageUrl} alt={it.title} className="aspect-[3/2] w-full object-cover" loading="lazy" />
                )}
                <div className="p-2">
                  <div className="line-clamp-2 text-xs group-hover:text-accent">{it.title}</div>
                  <div className="mt-1 text-[11px] text-muted">{it.date}</div>
                </div>
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">作品情報は DMM Web Service の提供です（Powered by FANZA Webサービス）。</p>
        </section>
      )}

      {dugaItems.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            {actress.name}の出演作品（DUGA） <PrBadge />
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {dugaItems.map((it) => (
              <a key={it.productId} href={it.affiliateUrl} target="_blank" rel="sponsored nofollow noopener" className="group overflow-hidden rounded-xl border border-line bg-surface hover:border-rose-500/40">
                {(it.jacketUrl || it.posterUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.jacketUrl || it.posterUrl} alt={it.title} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                )}
                <div className="p-2">
                  <div className="line-clamp-2 text-xs group-hover:text-accent">{it.title}</div>
                  <div className="mt-1 text-[11px] text-muted">{it.releaseDate}</div>
                </div>
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">作品情報は DUGA ウェブサービスの提供です（Powered by DUGA）。</p>
        </section>
      )}
    </div>
  );
}
