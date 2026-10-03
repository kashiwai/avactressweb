import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Ban } from "lucide-react";
import { db } from "@/db";
import { actresses, removalRequests } from "@/db/schema";
import { setOptOut, updateRemoval } from "@/lib/actions/admin";
import { formatDateTimeJst } from "@/lib/dates";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/client";
import { Badge, Card, PageHeader, SelectField, TextAreaField } from "@/components/ui";
import { REQUESTER_LABEL, STATUS_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AdminRemovalDetail({ params }: PageProps<"/admin/removals/[id]">) {
  const id = Number((await params).id);
  const [r] = Number.isInteger(id) ? await db.select().from(removalRequests).where(eq(removalRequests.id, id)) : [];
  if (!r) notFound();
  const [target] = r.targetActressId ? await db.select().from(actresses).where(eq(actresses.id, r.targetActressId)) : [];

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="削除依頼の詳細" description={`受付：${formatDateTimeJst(r.createdAt)}`} />
      <Card className="space-y-3 p-5 text-sm">
        <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
          <dt className="text-muted">依頼者</dt><dd>{r.requesterName}（{REQUESTER_LABEL[r.requesterType]}）</dd>
          <dt className="text-muted">連絡先</dt><dd className="break-all">{r.contact}</dd>
          <dt className="text-muted">対象</dt><dd className="break-all">{r.targetText}</dd>
          <dt className="text-muted">理由</dt><dd className="whitespace-pre-wrap">{r.reason}</dd>
          <dt className="text-muted">状態</dt><dd><Badge tone={r.status === "new" ? "warn" : "muted"}>{STATUS_LABEL[r.status]}</Badge></dd>
        </dl>
      </Card>
      {target && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="text-sm">
            対象の女優：<Link href={`/admin/actresses/${target.id}`} className="text-accent hover:underline">{target.name}</Link>{" "}
            {target.optedOut ? <Badge tone="warn">掲載停止済み</Badge> : <Badge tone="ok">掲載中</Badge>}
          </div>
          {!target.optedOut && (
            <form action={setOptOut}>
              <input type="hidden" name="id" value={target.id} />
              <input type="hidden" name="optedOut" value="1" />
              <input type="hidden" name="back" value={`/admin/removals/${r.id}`} />
              <ConfirmSubmit message={`「${target.name}」の掲載を停止します。公開画面から即座に消えます。よろしいですか？`}><Ban className="size-4" aria-hidden />この女優の掲載を停止する</ConfirmSubmit>
            </form>
          )}
        </Card>
      )}
      <Card className="p-5">
        <h2 className="mb-3 font-bold">対応状況の更新</h2>
        <ActionForm action={updateRemoval}>
          <input type="hidden" name="id" value={r.id} />
          <SelectField label="状態" name="status" defaultValue={r.status} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
          <TextAreaField label="運営メモ（依頼者には表示されません）" name="adminNote" maxLength={2000} defaultValue={r.adminNote} />
          <SubmitButton>保存する</SubmitButton>
        </ActionForm>
      </Card>
      <Link href="/admin/removals" className="text-sm text-muted underline hover:text-foreground">一覧へ戻る</Link>
    </div>
  );
}
