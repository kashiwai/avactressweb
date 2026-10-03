import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shops } from "@/db/schema";
import { updateShop } from "@/lib/actions/admin";
import { ShopFields } from "@/components/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditShopPage({ params }: PageProps<"/admin/shops/[id]/edit">) {
  const id = Number((await params).id);
  const [shop] = Number.isInteger(id) ? await db.select().from(shops).where(eq(shops.id, id)) : [];
  if (!shop) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`${shop.name} を編集`} />
      <Card className="p-5">
        <ActionForm action={updateShop}>
          <ShopFields shop={shop} />
          <div className="flex gap-2">
            <SubmitButton>保存する</SubmitButton>
            <LinkButton href={`/admin/shops/${shop.id}`} variant="ghost">キャンセル</LinkButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
