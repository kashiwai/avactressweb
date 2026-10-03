import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { removalRequests } from "@/db/schema";
import { formatDateTimeJst } from "@/lib/dates";
import { REQUESTER_LABEL, STATUS_LABEL } from "@/lib/labels";
import { Badge, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminRemovalsPage({ searchParams }: PageProps<"/admin/removals">) {
  const sp = await searchParams;
  const st = typeof sp.status === "string" && sp.status in STATUS_LABEL ? (sp.status as keyof typeof STATUS_LABEL) : null;
  const rows = await db.select().from(removalRequests).where(st ? eq(removalRequests.status, st) : undefined).orderBy(desc(removalRequests.createdAt));
  return (
    <div>
      <PageHeader title="削除依頼" description="ご本人・事務所からの依頼は、確認できしだい女優の「掲載を停止する」で対応してください。" />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/removals" className={!st ? "rounded-lg bg-accent px-3 py-1 text-white" : "rounded-lg border border-line px-3 py-1 text-muted"}>すべて</Link>
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <Link key={k} href={`/admin/removals?status=${k}`} className={st === k ? "rounded-lg bg-accent px-3 py-1 text-white" : "rounded-lg border border-line px-3 py-1 text-muted"}>{v}</Link>
        ))}
      </div>
      {rows.length === 0 ? <EmptyState title="該当する依頼はありません" /> : (
        <Table>
          <thead><tr><Th>受付日時</Th><Th>依頼者</Th><Th>対象</Th><Th>状態</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2/50">
                <Td className="whitespace-nowrap"><Link href={`/admin/removals/${r.id}`} className="text-accent hover:underline">{formatDateTimeJst(r.createdAt)}</Link></Td>
                <Td>{r.requesterName}<span className="block text-xs text-muted">{REQUESTER_LABEL[r.requesterType]}</span></Td>
                <Td className="max-w-xs truncate">{r.targetText}</Td>
                <Td><Badge tone={r.status === "new" ? "warn" : r.status === "done" ? "ok" : "muted"}>{STATUS_LABEL[r.status]}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
