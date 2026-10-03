import Link from "next/link";
import { asc, ilike, or, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { actresses, enrollments } from "@/db/schema";
import { Avatar, Badge, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { fillDmmImages } from "@/lib/actions/admin";
import { dmmConfigured } from "@/lib/dmm";

export const dynamic = "force-dynamic";

export default async function AdminActressesPage({ searchParams }: PageProps<"/admin/actresses">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const rows = await db
    .select({
      a: actresses,
      enrolled: sql<number>`(select count(*)::int from ${enrollments} e where e.actress_id = "actresses"."id" and e.status = 'active')`,
    })
    .from(actresses)
    .where(q ? or(ilike(actresses.name, `%${q}%`), ilike(actresses.kana, `%${q}%`)) : undefined)
    .orderBy(asc(actresses.kana), asc(actresses.name));

  const missing = rows.filter(({ a }) => !a.dmmActressId).length;

  return (
    <div>
      <PageHeader
        title="女優"
        description={`${rows.length}人`}
        actions={<LinkButton href="/admin/actresses/new"><Plus className="size-4" aria-hidden />新規作成</LinkButton>}
      />
      <div className="mb-4 rounded-lg border border-line bg-surface-2 p-3 text-sm">
        {dmmConfigured() ? (
          <form action={fillDmmImages} className="flex flex-wrap items-center gap-3">
            <SubmitButton variant="secondary">DMMから写真を一括取得</SubmitButton>
            <span className="text-muted">
              DMM IDが未設定の女優（あと{missing}人）を名前で検索し、同じ名前が1人だけ見つかった女優に写真とIDを入れます。1回に40人まで・数十秒かかります。
            </span>
          </form>
        ) : (
          <p className="text-muted">DMMのAPIキーが未設定のため、写真の一括取得は使えません（DMM IDが未設定の女優：{missing}人）。</p>
        )}
      </div>
      <form className="mb-4 flex gap-2" method="get">
        <input name="q" defaultValue={q} placeholder="名前・よみがなで検索" aria-label="名前・よみがなで検索" className="w-full max-w-sm rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        <button className="rounded-lg border border-line px-3 text-sm text-muted hover:text-foreground">検索</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="女優がまだ登録されていません" action={<LinkButton href="/admin/actresses/new">女優を登録する</LinkButton>} />
      ) : (
        <Table>
          <thead><tr><Th>名前</Th><Th>DMM ID</Th><Th>在籍</Th><Th>状態</Th></tr></thead>
          <tbody>
            {rows.map(({ a, enrolled }) => (
              <tr key={a.id} className="hover:bg-surface-2/50">
                <Td>
                  <Link href={`/admin/actresses/${a.id}`} className="flex items-center gap-2 font-medium text-accent hover:underline">
                    <Avatar name={a.name} src={a.imageUrl} size={32} />
                    <span>{a.name}<span className="block text-xs font-normal text-muted">{a.kana}</span></span>
                  </Link>
                </Td>
                <Td>{a.dmmActressId ?? <span className="text-muted">未設定</span>}</Td>
                <Td>{enrolled}店</Td>
                <Td>{a.optedOut ? <Badge tone="warn">掲載停止</Badge> : a.isPublished ? <Badge tone="ok">公開</Badge> : <Badge>非公開</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
