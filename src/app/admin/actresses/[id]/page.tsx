import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { Ban, ExternalLink, Eye, EyeOff, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { db } from "@/db";
import { actresses, affiliateLinks, enrollments, removalRequests, shops } from "@/db/schema";
import { addLink, deleteActress, deleteLink, setOptOut, toggleLink } from "@/lib/actions/admin";
import { prefName } from "@/lib/prefectures";
import { formatDateTimeJst } from "@/lib/dates";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/client";
import { Avatar, Badge, Card, EmptyState, Field, LinkButton, PageHeader, SelectField, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminActressDetail({ params }: PageProps<"/admin/actresses/[id]">) {
  const id = Number((await params).id);
  const [a] = Number.isInteger(id) ? await db.select().from(actresses).where(eq(actresses.id, id)) : [];
  if (!a) notFound();
  const [enr, links, reqs] = await Promise.all([
    db.select({ e: enrollments, s: shops }).from(enrollments).innerJoin(shops, eq(shops.id, enrollments.shopId)).where(eq(enrollments.actressId, id)),
    db.select().from(affiliateLinks).where(eq(affiliateLinks.actressId, id)).orderBy(asc(affiliateLinks.sortOrder), asc(affiliateLinks.id)),
    db.select().from(removalRequests).where(eq(removalRequests.targetActressId, id)).orderBy(desc(removalRequests.createdAt)),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={a.name}
        description={a.kana}
        actions={
          <>
            {!a.optedOut && a.isPublished && <LinkButton href={`/actresses/${a.id}`} variant="secondary" target="_blank"><ExternalLink className="size-4" aria-hidden />公開ページ</LinkButton>}
            <LinkButton href={`/admin/actresses/${a.id}/edit`} variant="secondary"><Pencil className="size-4" aria-hidden />編集</LinkButton>
            <form action={deleteActress}>
              <input type="hidden" name="id" value={a.id} />
              <ConfirmSubmit message={`「${a.name}」を削除します。在籍・出勤・リンクもすべて削除されます。よろしいですか？`}><Trash2 className="size-4" aria-hidden />削除</ConfirmSubmit>
            </form>
          </>
        }
      />

      <Card className="flex flex-col gap-4 p-5 sm:flex-row">
        <Avatar name={a.name} src={a.imageUrl} size={96} />
        <div className="flex-1 space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {a.optedOut ? <Badge tone="warn">掲載停止中</Badge> : a.isPublished ? <Badge tone="ok">公開</Badge> : <Badge>非公開</Badge>}
            {a.dmmActressId ? <Badge tone="info">DMM ID {a.dmmActressId}</Badge> : <Badge>DMM未連携</Badge>}
          </div>
          {a.profile && <p className="whitespace-pre-wrap text-foreground/90">{a.profile}</p>}
        </div>
        <div className="sm:w-56">
          <form action={setOptOut} className="space-y-2">
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="optedOut" value={a.optedOut ? "0" : "1"} />
            {a.optedOut ? (
              <ConfirmSubmit variant="secondary" message="掲載を再開します。本人・事務所の了承を確認済みですか？"><RotateCcw className="size-4" aria-hidden />掲載を再開する</ConfirmSubmit>
            ) : (
              <ConfirmSubmit message="掲載を停止します。公開画面のすべてから即座に消えます。よろしいですか？"><Ban className="size-4" aria-hidden />掲載を停止する</ConfirmSubmit>
            )}
            <p className="text-xs text-muted">本人・事務所から削除依頼があったときに使います。</p>
          </form>
        </div>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">在籍店舗</h2>
          <LinkButton href={`/admin/enrollments/new?actress=${a.id}`} variant="secondary"><Plus className="size-4" aria-hidden />在籍を追加</LinkButton>
        </div>
        {enr.length === 0 ? <EmptyState title="在籍がまだありません" description="お店が在籍を公表しているページのURLを用意してから登録してください。" /> : (
          <Table>
            <thead><tr><Th>店舗</Th><Th>店での名前</Th><Th>根拠</Th><Th>確認日</Th><Th>状態</Th><Th /></tr></thead>
            <tbody>
              {enr.map(({ e, s }) => (
                <tr key={e.id}>
                  <Td><Link prefetch={false} href={`/admin/shops/${s.id}`} className="text-accent hover:underline">{s.name}</Link><span className="block text-xs text-muted">{prefName(s.prefCode)}</span></Td>
                  <Td>{e.shopDisplayName}</Td>
                  <Td><a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">公表ページ</a></Td>
                  <Td>{e.verifiedAt}</Td>
                  <Td>{e.status === "active" ? <Badge tone="ok">在籍中</Badge> : <Badge>退店</Badge>}</Td>
                  <Td><Link prefetch={false} href={`/admin/enrollments/${e.id}`} className="text-accent hover:underline">出勤を編集</Link></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-1 font-bold">外部リンク（myfans・FANZA個別作品など）</h2>
          <p className="mb-3 text-xs text-muted">公開ページに「PR」表記付きのボタンとして表示されます。</p>
          {links.length === 0 ? <p className="text-sm text-muted">まだ登録されていません。</p> : (
            <ul className="mb-4 divide-y divide-line text-sm">
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className={l.enabled ? "min-w-0 truncate hover:text-accent" : "min-w-0 truncate text-muted line-through"}>
                    {l.label}<span className="ml-1 text-xs text-muted">（{l.provider}）</span>
                  </a>
                  <span className="flex shrink-0 gap-1">
                    <form action={toggleLink}><input type="hidden" name="id" value={l.id} /><SubmitButton variant="secondary" className="px-2 py-1">{l.enabled ? <EyeOff className="size-4" aria-label="非表示にする" /> : <Eye className="size-4" aria-label="表示する" />}</SubmitButton></form>
                    <form action={deleteLink}><input type="hidden" name="id" value={l.id} /><ConfirmSubmit message="このリンクを削除しますか？" className="px-2 py-1"><Trash2 className="size-4" aria-label="削除" /></ConfirmSubmit></form>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addLink} className="space-y-3 border-t border-line pt-3">
            <input type="hidden" name="actressId" value={a.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="提供元" name="provider" defaultValue="myfans" options={[{ value: "myfans", label: "myfans" }, { value: "fanza", label: "FANZA" }, { value: "other", label: "その他" }]} />
              <Field label="表示名" name="label" required maxLength={60} placeholder="例：myfans公式ページ" />
            </div>
            <Field label="URL（アフィリエイトリンク）" name="url" type="url" required maxLength={1000} />
            <Field label="並び順" name="sortOrder" type="number" min={0} max={999} defaultValue={0} />
            <SubmitButton variant="secondary"><Plus className="size-4" aria-hidden />リンクを追加</SubmitButton>
          </ActionForm>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-bold">この女優に関する削除依頼</h2>
          {reqs.length === 0 ? <p className="text-sm text-muted">ありません。</p> : (
            <ul className="divide-y divide-line text-sm">
              {reqs.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <Link prefetch={false} href={`/admin/removals/${r.id}`} className="hover:text-accent">{formatDateTimeJst(r.createdAt)} {r.requesterName}</Link>
                  <Badge tone={r.status === "new" ? "warn" : "muted"}>{{ new: "新規", in_progress: "対応中", done: "完了", rejected: "却下" }[r.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
