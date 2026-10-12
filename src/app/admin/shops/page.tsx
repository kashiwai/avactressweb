import Link from "next/link";
import { asc, ilike, or, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { enrollments, shops } from "@/db/schema";
import { prefName } from "@/lib/prefectures";
import { Badge, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminShopsPage({ searchParams }: PageProps<"/admin/shops">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const rows = await db
    .select({
      shop: shops,
      enrolled: sql<number>`(select count(*)::int from ${enrollments} e where e.shop_id = "shops"."id" and e.status = 'active')`,
    })
    .from(shops)
    .where(q ? or(ilike(shops.name, `%${q}%`), ilike(shops.area, `%${q}%`)) : undefined)
    .orderBy(asc(shops.prefCode), asc(shops.name));

  return (
    <div>
      <PageHeader
        title="店舗"
        description={`${rows.length}店`}
        actions={
          <LinkButton href="/admin/shops/new">
            <Plus className="size-4" aria-hidden />
            新規作成
          </LinkButton>
        }
      />
      <form className="mb-4 flex gap-2" method="get">
        <input name="q" defaultValue={q} placeholder="店舗名・エリアで検索" aria-label="店舗名・エリアで検索" className="w-full max-w-sm rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        <button className="rounded-lg border border-line px-3 text-sm text-muted hover:text-foreground">検索</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="店舗がまだありません" description="最初の店舗を登録しましょう。" action={<LinkButton href="/admin/shops/new">店舗を登録する</LinkButton>} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>店舗名</Th>
              <Th>地域</Th>
              <Th>業種</Th>
              <Th>在籍</Th>
              <Th>公開</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ shop, enrolled }) => (
              <tr key={shop.id} className="hover:bg-surface-2/50">
                <Td>
                  <Link prefetch={false} href={`/admin/shops/${shop.id}`} className="font-medium text-accent hover:underline">{shop.name}</Link>
                </Td>
                <Td>{prefName(shop.prefCode)} {shop.area}</Td>
                <Td>{shop.genre}</Td>
                <Td>{enrolled}人{shop.anonymousAvCount > 0 && <span className="text-muted">（＋非公開{shop.anonymousAvCount}）</span>}</Td>
                <Td>{shop.isPublished ? <Badge tone="ok">公開</Badge> : <Badge>非公開</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
