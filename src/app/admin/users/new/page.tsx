import { createUser } from "@/lib/actions/admin";
import { shopOptions } from "@/lib/admin-options";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field, LinkButton, PageHeader, SelectField } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewUserPage({ searchParams }: PageProps<"/admin/users/new">) {
  const sp = await searchParams;
  const preShop = Number(sp.shop) || "";
  const s = await shopOptions();
  return (
    <div className="max-w-xl">
      <PageHeader title="アカウントを作成" description="作成後、メールアドレスとパスワードを相手に安全な方法でお伝えください。" />
      <Card className="p-5">
        <ActionForm action={createUser}>
          <SelectField label="役割" name="role" defaultValue={preShop ? "shop" : "admin"} options={[{ value: "shop", label: "お店（自店の出勤だけ編集できる）" }, { value: "admin", label: "運営者（すべて操作できる）" }]} />
          <SelectField label="所属店舗（お店の場合）" name="shopId" defaultValue={preShop} options={[{ value: "", label: "選択しない" }, ...s.map((x) => ({ value: x.id, label: x.name }))]} />
          <Field label="メールアドレス" name="email" type="email" required autoComplete="off" />
          <Field label="表示名" name="displayName" maxLength={60} />
          <Field label="初期パスワード" name="password" type="password" required minLength={10} autoComplete="new-password" hint="10文字以上" />
          <div className="flex gap-2">
            <SubmitButton>作成する</SubmitButton>
            <LinkButton href="/admin/users" variant="ghost">キャンセル</LinkButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
