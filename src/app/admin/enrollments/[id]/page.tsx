import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, gte, lte } from "drizzle-orm";
import { CheckCheck, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { db } from "@/db";
import { actresses, enrollments, schedules, shops } from "@/db/schema";
import { deleteEnrollment, reverifyEnrollment } from "@/lib/actions/admin";
import { addDays, isYmd, todayJst } from "@/lib/dates";
import { prefName } from "@/lib/prefectures";
import { EDITOR_DAYS, ScheduleEditor } from "@/components/schedule-editor";
import { ConfirmSubmit, SubmitButton } from "@/components/client";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminEnrollmentDetail({ params, searchParams }: PageProps<"/admin/enrollments/[id]">) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const rows = Number.isInteger(id)
    ? await db
        .select({ e: enrollments, a: actresses, s: shops })
        .from(enrollments)
        .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
        .innerJoin(shops, eq(shops.id, enrollments.shopId))
        .where(eq(enrollments.id, id))
    : [];
  const row = rows[0];
  if (!row) notFound();
  const { e, a, s } = row;
  const from = typeof sp.from === "string" && isYmd(sp.from) ? sp.from : todayJst();
  const sch = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.enrollmentId, e.id), gte(schedules.workDate, from), lte(schedules.workDate, addDays(from, EDITOR_DAYS - 1))));
  const stale = e.verifiedAt < addDays(todayJst(), -30);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${a.name} ／ ${s.name}`}
        description={<>{prefName(s.prefCode)} {s.area}　店での名前：{e.shopDisplayName}　{e.status === "active" ? <Badge tone="ok">在籍中</Badge> : <Badge>退店</Badge>}</>}
        actions={
          <>
            <LinkButton href={`/admin/enrollments/${e.id}/edit`} variant="secondary"><Pencil className="size-4" aria-hidden />在籍を編集</LinkButton>
            <form action={deleteEnrollment}>
              <input type="hidden" name="id" value={e.id} />
              <ConfirmSubmit message="この在籍を削除します。出勤の記録もすべて削除されます。退店の場合は「編集」で状態を退店にする方法もあります。削除しますか？"><Trash2 className="size-4" aria-hidden />削除</ConfirmSubmit>
            </form>
          </>
        }
      />
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div className="space-y-1">
          <div>
            <span className="text-muted">根拠：</span>
            <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline">{e.sourceUrl}<ExternalLink className="size-3" aria-hidden /></a>
          </div>
          {e.sourceNote && <div className="text-muted">{e.sourceNote}</div>}
          <div>
            <span className="text-muted">確認日：</span>{e.verifiedAt} {stale && <Badge tone="warn">30日以上未確認</Badge>}
          </div>
          <div className="flex gap-3 pt-1">
            <Link href={`/admin/actresses/${a.id}`} className="text-accent hover:underline">女優の詳細</Link>
            <Link href={`/admin/shops/${s.id}`} className="text-accent hover:underline">店舗の詳細</Link>
          </div>
        </div>
        <form action={reverifyEnrollment}>
          <input type="hidden" name="id" value={e.id} />
          <SubmitButton variant="secondary"><CheckCheck className="size-4" aria-hidden />今日確認した</SubmitButton>
        </form>
      </Card>
      <section>
        <h2 className="mb-3 font-bold">出勤表</h2>
        <ScheduleEditor enrollmentId={e.id} from={from} rows={sch} basePath={`/admin/enrollments/${e.id}`} />
      </section>
    </div>
  );
}
