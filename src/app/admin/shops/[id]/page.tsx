import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/db";
import { actresses, dataSources, enrollments, schedules, shops, users } from "@/db/schema";
import { deleteShop } from "@/lib/actions/admin";
import { prefName } from "@/lib/prefectures";
import { hm, todayJst } from "@/lib/dates";
import { ConfirmSubmit } from "@/components/client";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminShopDetail({ params }: PageProps<"/admin/shops/[id]">) {
  const id = Number((await params).id);
  const [shop] = Number.isInteger(id) ? await db.select().from(shops).where(eq(shops.id, id)) : [];
  if (!shop) notFound();
  const today = todayJst();
  const [enr, sources, accounts] = await Promise.all([
    db
      .select({ e: enrollments, a: actresses, s: schedules })
      .from(enrollments)
      .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
      .leftJoin(schedules, and(eq(schedules.enrollmentId, enrollments.id), eq(schedules.workDate, today)))
      .where(eq(enrollments.shopId, id))
      .orderBy(asc(actresses.kana)),
    db.select().from(dataSources).where(eq(dataSources.shopId, id)),
    db.select({ id: users.id, email: users.email }).from(users).where(eq(users.shopId, id)),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={shop.name}
        description={<>{prefName(shop.prefCode)} {shop.area}／{shop.genre || "業種未設定"}　{shop.isPublished ? <Badge tone="ok">公開</Badge> : <Badge>非公開</Badge>}</>}
        actions={
          <>
            <LinkButton href={`/shops/${shop.id}`} variant="secondary" target="_blank"><ExternalLink className="size-4" aria-hidden />公開ページ</LinkButton>
            <LinkButton href={`/admin/shops/${shop.id}/edit`} variant="secondary"><Pencil className="size-4" aria-hidden />編集</LinkButton>
            <form action={deleteShop}>
              <input type="hidden" name="id" value={shop.id} />
              <ConfirmSubmit message={`「${shop.name}」を削除します。在籍・出勤・取り込み元・お店アカウントもすべて削除されます。よろしいですか？`}>
                <Trash2 className="size-4" aria-hidden />削除
              </ConfirmSubmit>
            </form>
          </>
        }
      />

      <Card className="grid gap-3 p-5 text-sm sm:grid-cols-2">
        <div><span className="text-muted">公式サイト：</span>{shop.officialUrl ? <a href={shop.officialUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">{shop.officialUrl}</a> : "—"}</div>
        <div><span className="text-muted">電話：</span>{shop.phone || "—"}</div>
        <div><span className="text-muted">営業時間：</span>{shop.businessHours || "—"}</div>
        <div><span className="text-muted">名前非公開の在籍：</span>{shop.anonymousAvCount}人 {shop.anonymousAvSourceUrl && <a href={shop.anonymousAvSourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">根拠</a>}</div>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">在籍している女優（本日の出勤）</h2>
          <LinkButton href={`/admin/enrollments/new?shop=${shop.id}`} variant="secondary"><Plus className="size-4" aria-hidden />在籍を追加</LinkButton>
        </div>
        {enr.length === 0 ? (
          <EmptyState title="在籍がまだありません" />
        ) : (
          <Table>
            <thead><tr><Th>女優</Th><Th>店での名前</Th><Th>状態</Th><Th>本日</Th><Th>出勤表</Th></tr></thead>
            <tbody>
              {enr.map(({ e, a, s }) => (
                <tr key={e.id}>
                  <Td><Link prefetch={false} href={`/admin/actresses/${a.id}`} className="text-accent hover:underline">{a.name}</Link></Td>
                  <Td>{e.shopDisplayName}</Td>
                  <Td>{e.status === "active" ? <Badge tone="ok">在籍中</Badge> : <Badge>退店</Badge>}</Td>
                  <Td>{s ? (s.status === "working" ? <Badge tone="ok">出勤 {hm(s.startTime)}</Badge> : <Badge>休み</Badge>) : <span className="text-muted">未定</span>}</Td>
                  <Td><Link prefetch={false} href={`/admin/enrollments/${e.id}`} className="text-accent hover:underline">出勤を編集</Link></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">取り込み元</h2>
            <Link prefetch={false} href="/admin/sources/new" className="text-sm text-accent underline">追加</Link>
          </div>
          {sources.length === 0 ? <p className="text-sm text-muted">登録されていません。</p> : (
            <ul className="space-y-1 text-sm">
              {sources.map((s) => (
                <li key={s.id}><Link prefetch={false} href={`/admin/sources/${s.id}`} className="text-accent hover:underline">{s.name}</Link> {s.enabled ? <Badge tone="ok">有効</Badge> : <Badge>停止中</Badge>}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">お店アカウント</h2>
            <Link prefetch={false} href={`/admin/users/new?shop=${shop.id}`} className="text-sm text-accent underline">発行</Link>
          </div>
          {accounts.length === 0 ? <p className="text-sm text-muted">まだありません。発行すると、お店が自分で出勤を入力できます。</p> : (
            <ul className="space-y-1 text-sm">
              {accounts.map((u) => <li key={u.id}><Link prefetch={false} href={`/admin/users/${u.id}`} className="text-accent hover:underline">{u.email}</Link></li>)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
