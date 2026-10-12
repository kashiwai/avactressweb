import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Pencil, Play, Trash2 } from "lucide-react";
import { db } from "@/db";
import { dataSources, ingestRuns, shops } from "@/db/schema";
import { deleteSource, runSourceNow } from "@/lib/actions/admin";
import { formatDateTimeJst } from "@/lib/dates";
import { ConfirmSubmit, SubmitButton } from "@/components/client";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";
import { FeedFormatHelp } from "../help";

export const dynamic = "force-dynamic";
// 「今すぐ実行」で約3分処理するため、実行時間の上限を延ばす
export const maxDuration = 300;

export default async function AdminSourceDetail({ params }: PageProps<"/admin/sources/[id]">) {
  const id = Number((await params).id);
  const rows = Number.isInteger(id) ? await db.select({ d: dataSources, s: shops }).from(dataSources).leftJoin(shops, eq(shops.id, dataSources.shopId)).where(eq(dataSources.id, id)) : [];
  if (!rows[0]) notFound();
  const { d, s } = rows[0];
  const runs = await db.select().from(ingestRuns).where(eq(ingestRuns.sourceId, id)).orderBy(desc(ingestRuns.startedAt)).limit(30);

  return (
    <div className="space-y-6">
      <PageHeader
        title={d.name}
        description={<>対象：{s ? <Link prefetch={false} href={`/admin/shops/${s.id}`} className="text-accent hover:underline">{s.name}</Link> : "複数の店舗（ページから自動判定）"}　{d.enabled ? <Badge tone="ok">有効</Badge> : <Badge>停止中</Badge>} {d.termsConfirmed ? <Badge tone="info">規約確認済み</Badge> : <Badge tone="warn">規約未確認</Badge>}</>}
        actions={
          <>
            <form action={runSourceNow}>
              <input type="hidden" name="id" value={d.id} />
              <SubmitButton><Play className="size-4" aria-hidden />今すぐ実行</SubmitButton>
            </form>
            <LinkButton href={`/admin/sources/${d.id}/edit`} variant="secondary"><Pencil className="size-4" aria-hidden />編集</LinkButton>
            <form action={deleteSource}>
              <input type="hidden" name="id" value={d.id} />
              <ConfirmSubmit message="この取り込み元と実行履歴を削除します。取り込み済みの出勤は残ります。よろしいですか？"><Trash2 className="size-4" aria-hidden />削除</ConfirmSubmit>
            </form>
          </>
        }
      />
      <Card className="p-4 text-sm">
        <span className="text-muted">URL：</span><span className="break-all">{d.url}</span>
        <div className="mt-1"><span className="text-muted">最終結果：</span>{d.lastStatus ?? "未実行"}</div>
      </Card>
      <section>
        <h2 className="mb-3 font-bold">実行履歴</h2>
        {runs.length === 0 ? <EmptyState title="まだ実行していません" description="「今すぐ実行」で動作を確かめられます。" /> : (
          <Table>
            <thead><tr><Th>開始</Th><Th>結果</Th><Th>取得</Th><Th>反映</Th><Th>新規</Th><Th>未照合・エラー</Th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{formatDateTimeJst(r.startedAt)}</Td>
                  <Td>{r.ok ? <Badge tone="ok">成功</Badge> : r.finishedAt ? <Badge tone="warn">失敗</Badge> : <Badge>実行中</Badge>}</Td>
                  <Td>{r.fetchedCount}</Td>
                  <Td>{r.appliedCount}</Td>
                  <Td className="whitespace-nowrap text-xs">女優{r.createdActresses}／店舗{r.createdShops}</Td>
                  <Td className="text-xs">{r.error ? <span className="text-red-700">{r.error}</span> : r.unmatchedNames.length ? r.unmatchedNames.join("、") : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
      <FeedFormatHelp />
    </div>
  );
}
