import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { dataSources, shops } from "@/db/schema";
import { formatDateTimeJst } from "@/lib/dates";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { registerRecommendedSources } from "@/lib/actions/admin";
import { RECOMMENDED_SOURCES } from "@/lib/ingest/recommended";

export const dynamic = "force-dynamic";

export default async function AdminSourcesPage() {
  const rows = await db.select({ d: dataSources, s: shops }).from(dataSources).leftJoin(shops, eq(shops.id, dataSources.shopId)).orderBy(asc(dataSources.name));
  return (
    <div className="space-y-4">
      <PageHeader title="取り込み元" description="有効かつ規約確認済みの取り込み元から、10分ごとの自動実行で出勤・在籍を取り込みます（出勤は毎日、在籍情報は3日ごとに一覧を読み直します）。" actions={<LinkButton href="/admin/sources/new"><Plus className="size-4" aria-hidden />新規作成</LinkButton>} />
      {(() => {
        const missing = RECOMMENDED_SOURCES.filter((r) => !rows.some(({ d }) => d.url === r.url));
        const pagesOff = RECOMMENDED_SOURCES.filter((r) => rows.some(({ d }) => d.url === r.url && d.maxPages !== r.maxPages));
        if (missing.length === 0 && pagesOff.length === 0) return null;
        return (
          <Card className="space-y-3 border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="font-medium">
              許可済みの取り込み元のうち、未登録が{missing.length}件{pagesOff.length ? `、ページ数の見直しが必要なものが${pagesOff.length}件` : ""}あります。
            </p>
            {missing.length > 0 && <p className="text-xs text-muted">未登録：{missing.map((m) => m.name).join("、")}</p>}
            <form action={registerRecommendedSources}>
              <SubmitButton>おすすめの取り込み元をまとめて登録</SubmitButton>
            </form>
          </Card>
        );
      })()}
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
                <Td><Link prefetch={false} href={`/admin/sources/${d.id}`} className="font-medium text-accent hover:underline">{d.name}</Link></Td>
                <Td>{s?.name ?? (d.kind === "avzoku" || d.kind === "avfuzoku" ? "複数（ページから自動判定）" : "—")}</Td>
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
