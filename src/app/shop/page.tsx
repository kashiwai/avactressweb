import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { actresses, enrollments, schedules, shops } from "@/db/schema";
import { requireShop } from "@/lib/auth";
import { updateOwnAnonymousCount } from "@/lib/actions/admin";
import { hm, shortDate, todayJst } from "@/lib/dates";
import { ActionForm, SubmitButton } from "@/components/client";
import { Badge, Card, EmptyState, Field, PageHeader, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ShopHome() {
  const u = await requireShop();
  const today = todayJst();
  const [[shop], rows] = await Promise.all([
    db.select().from(shops).where(eq(shops.id, u.shopId)),
    db
      .select({ e: enrollments, a: actresses, t: schedules })
      .from(enrollments)
      .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
      .leftJoin(schedules, and(eq(schedules.enrollmentId, enrollments.id), eq(schedules.workDate, today)))
      .where(and(eq(enrollments.shopId, u.shopId), eq(enrollments.status, "active")))
      .orderBy(asc(actresses.kana)),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="在籍と出勤" description={`${shortDate(today)}　女優名を押すと、14日分の出勤をまとめて入力できます。`} />
      {rows.length === 0 ? (
        <EmptyState title="在籍している女優が登録されていません" description="在籍の登録は運営者が行います。追加したい方がいる場合は、公表ページのURLを添えて運営者へご連絡ください。" />
      ) : (
        <Table>
          <thead><tr><Th>女優</Th><Th>店での名前</Th><Th>本日</Th><Th /></tr></thead>
          <tbody>
            {rows.map(({ e, a, t }) => (
              <tr key={e.id}>
                <Td><Link prefetch={false} href={`/shop/enrollments/${e.id}`} className="font-medium text-accent hover:underline">{a.name}</Link></Td>
                <Td>{e.shopDisplayName}</Td>
                <Td>{t ? (t.status === "working" ? <Badge tone="ok">出勤 {hm(t.startTime)}〜{hm(t.endTime)}</Badge> : <Badge>休み</Badge>) : <span className="text-muted">未入力</span>}</Td>
                <Td><Link prefetch={false} href={`/shop/enrollments/${e.id}`} className="text-accent hover:underline">出勤を入力</Link></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {shop && (
        <Card className="max-w-xl p-5">
          <h2 className="mb-1 font-bold">名前非公開のAV女優在籍数</h2>
          <p className="mb-3 text-xs text-muted">お店として「AV女優在籍（名前非公開）」と公表している人数を載せられます。公表しているページのURLが必要です。</p>
          <ActionForm action={updateOwnAnonymousCount}>
            <Field label="人数" name="anonymousAvCount" type="number" min={0} max={999} defaultValue={shop.anonymousAvCount} />
            <Field label="公表しているページのURL" name="anonymousAvSourceUrl" type="url" maxLength={1000} defaultValue={shop.anonymousAvSourceUrl} />
            <SubmitButton>保存する</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
