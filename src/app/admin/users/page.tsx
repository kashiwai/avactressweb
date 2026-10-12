import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { shops, users } from "@/db/schema";
import { formatDateTimeJst } from "@/lib/dates";
import { Badge, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const rows = await db
    .select({ id: users.id, email: users.email, role: users.role, displayName: users.displayName, createdAt: users.createdAt, shopName: shops.name, shopId: shops.id })
    .from(users)
    .leftJoin(shops, eq(shops.id, users.shopId))
    .orderBy(asc(users.role), asc(users.email));
  return (
    <div>
      <PageHeader title="アカウント" description="運営者アカウントと、出勤を入力するお店アカウントを管理します。" actions={<LinkButton href="/admin/users/new"><Plus className="size-4" aria-hidden />新規作成</LinkButton>} />
      <Table>
        <thead><tr><Th>メールアドレス</Th><Th>名前</Th><Th>役割</Th><Th>所属店舗</Th><Th>作成日</Th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="hover:bg-surface-2/50">
              <Td><Link prefetch={false} href={`/admin/users/${u.id}`} className="text-accent hover:underline">{u.email}</Link></Td>
              <Td>{u.displayName || "—"}</Td>
              <Td>{u.role === "admin" ? <Badge tone="accent">運営者</Badge> : <Badge tone="info">お店</Badge>}</Td>
              <Td>{u.shopId ? <Link prefetch={false} href={`/admin/shops/${u.shopId}`} className="hover:text-accent">{u.shopName}</Link> : "—"}</Td>
              <Td>{formatDateTimeJst(u.createdAt)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
