import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { db } from "@/db";
import { shops, users } from "@/db/schema";
import { deleteUser, resetPassword } from "@/lib/actions/admin";
import { formatDateTimeJst } from "@/lib/dates";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/client";
import { Badge, Card, Field, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminUserDetail({ params }: PageProps<"/admin/users/[id]">) {
  const id = Number((await params).id);
  const rows = Number.isInteger(id) ? await db.select({ u: users, s: shops }).from(users).leftJoin(shops, eq(shops.id, users.shopId)).where(eq(users.id, id)) : [];
  if (!rows[0]) notFound();
  const { u, s } = rows[0];
  return (
    <div className="max-w-xl space-y-5">
      <PageHeader
        title={u.email}
        description={<>{u.role === "admin" ? <Badge tone="accent">運営者</Badge> : <Badge tone="info">お店：{s?.name}</Badge>}　作成：{formatDateTimeJst(u.createdAt)}</>}
        actions={
          <form action={deleteUser}>
            <input type="hidden" name="id" value={u.id} />
            <ConfirmSubmit message="このアカウントを削除します。ログインできなくなります。よろしいですか？"><Trash2 className="size-4" aria-hidden />削除</ConfirmSubmit>
          </form>
        }
      />
      <Card className="p-5">
        <h2 className="mb-3 font-bold">パスワードの再設定</h2>
        <ActionForm action={resetPassword}>
          <input type="hidden" name="id" value={u.id} />
          <Field label="新しいパスワード" name="password" type="password" required minLength={10} autoComplete="new-password" hint="10文字以上" />
          <SubmitButton>再設定する</SubmitButton>
        </ActionForm>
      </Card>
      <LinkButton href="/admin/users" variant="ghost">一覧へ戻る</LinkButton>
    </div>
  );
}
