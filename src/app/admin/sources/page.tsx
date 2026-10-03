import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { dataSources, shops } from "@/db/schema";
import { formatDateTimeJst } from "@/lib/dates";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminSourcesPage() {
  const rows = await db.select({ d: dataSources, s: shops }).from(dataSources).leftJoin(shops, eq(shops.id, dataSources.shopId)).orderBy(asc(dataSources.name));
  return (
    <div className="space-y-4">
      <PageHeader title="取り込み元" description="毎日 5:00（日本時間）に、有効かつ規約確認済みの取り込み元から出勤を自動で取り込みます。" actions={<LinkButton href="/admin/sources/new"><Plus className="size-4" aria-hidden />新規作成</LinkButton>} />
      <Card className="p-4 text-xs leading-relaxed text-muted">
        登録できるのは、お店から提供を受けたデータの配信先か、規約と robots.txt で自動取得が許されているページだけです。シティヘブンなど、規約で自動取得を禁止しているポータルサイトは登録しないでください。実行前に robots.txt を毎回確認し、禁止されていれば取得しません。
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="取り込み元がまだありません" description="お店からJSON形式の出勤データを受け取れる場合に登録します。受け取れないお店は、お店アカウントを発行して出勤を入力してもらう方法もあります。" action={<LinkButton href="/admin/sources/new">取り込み元を登録する</LinkButton>} />
      ) : (
        <Table>
          <thead><tr><Th>名称</Th><Th>店舗</Th><Th>状態</Th><Th>最終実行</Th><Th>結果</Th></tr></thead>
          <tbody>
            {rows.map(({ d, s }) => (
              <tr key={d.id} className="hover:bg-surface-2/50">
                <Td><Link href={`/admin/sources/${d.id}`} className="font-medium text-accent hover:underline">{d.name}</Link></Td>
                <Td>{s?.name ?? (d.kind === "avzoku" ? "複数（ページから自動判定）" : "—")}</Td>
                <Td>{d.enabled ? <Badge tone="ok">有効</Badge> : <Badge>停止中</Badge>} {!d.termsConfirmed && <Badge tone="warn">規約未確認</Badge>}</Td>
                <Td>{formatDateTimeJst(d.lastRunAt)}</Td>
                <Td className="max-w-xs truncate text-xs">{d.lastStatus ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
