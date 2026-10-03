import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { actresses, enrollments, schedules } from "@/db/schema";
import { requireShop } from "@/lib/auth";
import { addDays, isYmd, todayJst } from "@/lib/dates";
import { EDITOR_DAYS, ScheduleEditor } from "@/components/schedule-editor";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ShopEnrollmentPage({ params, searchParams }: PageProps<"/shop/enrollments/[id]">) {
  const u = await requireShop();
  const id = Number((await params).id);
  const sp = await searchParams;
  // 自店の在籍でなければ「見つからない」扱いにする（他店のIDを直接指定しても見えない）
  const rows = Number.isInteger(id)
    ? await db
        .select({ e: enrollments, a: actresses })
        .from(enrollments)
        .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
        .where(and(eq(enrollments.id, id), eq(enrollments.shopId, u.shopId)))
    : [];
  if (!rows[0]) notFound();
  const { e, a } = rows[0];
  const from = typeof sp.from === "string" && isYmd(sp.from) ? sp.from : todayJst();
  const sch = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.enrollmentId, e.id), gte(schedules.workDate, from), lte(schedules.workDate, addDays(from, EDITOR_DAYS - 1))));
  return (
    <div className="space-y-4">
      <Link href="/shop" className="text-sm text-muted underline hover:text-foreground">在籍一覧へ戻る</Link>
      <PageHeader title={`${a.name} の出勤`} description={`店での名前：${e.shopDisplayName}`} />
      <ScheduleEditor enrollmentId={e.id} from={from} rows={sch} basePath={`/shop/enrollments/${e.id}`} />
    </div>
  );
}
