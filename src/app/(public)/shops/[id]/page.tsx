import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Clock, ExternalLink, Phone, UserRound } from "lucide-react";
import { getPublicShop } from "@/lib/queries";
import { dateRange, nowTimeJst, todayJst } from "@/lib/dates";
import { prefByCode, prefName } from "@/lib/prefectures";
import { AttendanceGrid, Legend, GenreBadge } from "@/components/public";
import { Avatar, Badge, Card } from "@/components/ui";
import { isWithinShift, hm } from "@/lib/dates";

export const dynamic = "force-dynamic";

async function load(idStr: string) {
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return null;
  return getPublicShop(id, 7);
}

export async function generateMetadata({ params }: PageProps<"/shops/[id]">): Promise<Metadata> {
  const data = await load((await params).id);
  if (!data) return { title: "店舗が見つかりません" };
  return { title: `${data.shop.name}（${prefName(data.shop.prefCode)}）のAV女優出勤情報` };
}

export default async function ShopDetailPage({ params }: PageProps<"/shops/[id]">) {
  const data = await load((await params).id);
  if (!data) notFound();
  const { shop, enrollments, schedules } = data;
  const today = todayJst();
  const nowHm = nowTimeJst();
  const dates = dateRange(today, 7);
  const pref = prefByCode(shop.prefCode);

  const rows = enrollments.map(({ enrollment, actress }) => ({
    key: enrollment.id,
    label: (
      <Link href={`/actresses/${actress.id}`} className="hover:text-accent">
        {actress.name}
        {enrollment.shopDisplayName !== actress.name && <span className="block text-[11px] font-normal text-muted">店名：{enrollment.shopDisplayName}</span>}
      </Link>
    ),
    cells: new Map(schedules.filter((s) => s.enrollmentId === enrollment.id).map((s) => [s.workDate, { status: s.status, startTime: s.startTime, endTime: s.endTime }])),
  }));

  return (
    <div className="space-y-6">
      <nav className="text-xs text-muted" aria-label="パンくず">
        <Link href="/" className="hover:text-foreground">トップ</Link> ／ <Link href="/shops" className="hover:text-foreground">店舗から探す</Link> ／{" "}
        {pref && <><Link href={`/areas/${pref.slug}`} className="hover:text-foreground">{pref.name}</Link> ／ </>}
        {shop.name}
      </nav>

      <Card className="p-5">
        <h1 className="text-2xl font-bold">{shop.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{prefName(shop.prefCode)} {shop.area}</span>
          <GenreBadge genre={shop.genre} />
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {shop.businessHours && <span className="flex items-center gap-1"><Clock className="size-4 text-muted" aria-hidden />{shop.businessHours}</span>}
          {shop.phone && <a href={`tel:${shop.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1 hover:text-accent"><Phone className="size-4 text-muted" aria-hidden />{shop.phone}</a>}
          {shop.officialUrl && (
            <a href={shop.officialUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 hover:text-accent">
              <ExternalLink className="size-4 text-muted" aria-hidden />公式サイト
            </a>
          )}
        </div>
        {shop.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{shop.description}</p>}
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-bold">在籍しているAV女優</h2>
        {enrollments.length === 0 && shop.anonymousAvCount === 0 ? (
          <Card className="p-6 text-sm text-muted">現在、在籍が公表されているAV女優はいません。</Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enrollments.map(({ enrollment, actress }) => {
              const t = schedules.find((s) => s.enrollmentId === enrollment.id && s.workDate === today);
              const live = t?.status === "working" && isWithinShift(t.startTime, t.endTime, nowHm);
              return (
                <Link key={enrollment.id} href={`/actresses/${actress.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-rose-500/40">
                  <Avatar name={actress.name} src={actress.imageUrl} size={52} />
                  <div className="min-w-0">
                    <div className="truncate font-bold">{actress.name}</div>
                    <div className="mt-1">
                      {t?.status === "working" ? (
                        <Badge tone={live ? "accent" : "ok"}>{live ? "● いま出勤中" : "本日出勤"} {t.startTime && `${hm(t.startTime)}〜${hm(t.endTime)}`}</Badge>
                      ) : t?.status === "off" ? (
                        <Badge>本日お休み</Badge>
                      ) : (
                        <Badge>本日未定</Badge>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
            {shop.anonymousAvCount > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3">
                <div className="flex size-[52px] items-center justify-center rounded-lg bg-surface-2"><UserRound className="size-6 text-muted" aria-hidden /></div>
                <div className="text-sm">
                  <div className="font-bold">AV女優在籍（名前非公開）{shop.anonymousAvCount}人</div>
                  <div className="text-xs text-muted">お店が名前を伏せて公表しています</div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-bold">週間出勤表</h2>
            <Legend />
          </div>
          <AttendanceGrid dates={dates} rows={rows} today={today} />
        </section>
      )}
    </div>
  );
}
