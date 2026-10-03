import { createShop } from "@/lib/actions/admin";
import { ShopFields } from "@/components/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export default function NewShopPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="店舗を登録" />
      <Card className="p-5">
        <ActionForm action={createShop}>
          <ShopFields />
          <div className="flex gap-2">
            <SubmitButton>登録する</SubmitButton>
            <LinkButton href="/admin/shops" variant="ghost">キャンセル</LinkButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
