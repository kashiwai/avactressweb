import Link from "next/link";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { actresses, enrollments, schedules, shops } from "@/db/schema";
import { hm, todayJst } from "@/lib/dates";
import { shopOptions } from "@/lib/admin-options";
import { Badge, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminEnrollmentsPage({ searchParams }: PageProps<"/admin/enrollments">) {
  const sp = await searchParams;
  const shopId = Number(sp.shop) || 0;
  const status = sp.status === "left" ? "left" : sp.status === "all" ? "all" : "active";
  const today = todayJst();
  const conds: SQL[] = [];
  if (shopId) conds.push(eq(enrollments.shopId, shopId));
  if (status !== "all") conds.push(eq(enrollments.status, status));

  const [rows, shopsOpt] = await Promise.all([
    db
      .select({ e: enrollments, a: actresses, s: shops, t: schedules })
      .from(enrollments)
      .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
      .innerJoin(shops, eq(shops.id, enrollments.shopId))
      .leftJoin(schedules, and(eq(schedules.enrollmentId, enrollments.id), eq(schedules.workDate, today)))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(shops.name), asc(actresses.kana)),
    shopOptions(),
  ]);

  return (
    <div>
      <PageHeader
        title="在籍・出勤"
        description={`${rows.length}件。行を開くと出勤表を編集できます`}
        actions={<LinkButton href="/admin/enrollments/new"><Plus className="size-4" aria-hidden />新規作成</LinkButton>}
      />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <select name="shop" defaultValue={shopId || ""} aria-label="店舗で絞り込み" className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          <option value="">すべての店舗</option>
          {shopsOpt.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select name="status" defaultValue={status} aria-label="状態で絞り込み" className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          <option value="active">在籍中</option>
          <option value="left">退店</option>
          <option value="all">すべて</option>
        </select>
        <button className="rounded-lg border border-line px-3 text-sm text-muted hover:text-foreground">絞り込む</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="該当する在籍はありません" action={<LinkButton href="/admin/enrollments/new">在籍を登録する</LinkButton>} />
      ) : (
        <Table>
          <thead><tr><Th>女優</Th><Th>店舗</Th><Th>店での名前</Th><Th>確認日</Th><Th>本日</Th><Th>状態</Th></tr></thead>
          <tbody>
            {rows.map(({ e, a, s, t }) => (
              <tr key={e.id} className="hover:bg-surface-2/50">
                <Td><Link href={`/admin/enrollments/${e.id}`} className="font-medium text-accent hover:underline">{a.name}</Link></Td>
                <Td><Link href={`/admin/shops/${s.id}`} className="hover:text-accent">{s.name}</Link></Td>
                <Td>{e.shopDisplayName}</Td>
                <Td>{e.verifiedAt}</Td>
                <Td>{t ? (t.status === "working" ? <Badge tone="ok">出勤 {hm(t.startTime)}</Badge> : <Badge>休み</Badge>) : <span className="text-muted">未定</span>}</Td>
                <Td>{e.status === "active" ? <Badge tone="ok">在籍中</Badge> : <Badge>退店</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
