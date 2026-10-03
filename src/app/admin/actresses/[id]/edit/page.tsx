import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { actresses } from "@/db/schema";
import { updateActress } from "@/lib/actions/admin";
import { ActressFields } from "@/components/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditActressPage({ params }: PageProps<"/admin/actresses/[id]/edit">) {
  const id = Number((await params).id);
  const [a] = Number.isInteger(id) ? await db.select().from(actresses).where(eq(actresses.id, id)) : [];
  if (!a) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`${a.name} を編集`} />
      <Card className="p-5">
        <ActionForm action={updateActress}>
          <ActressFields actress={a} />
          <div className="flex gap-2">
            <SubmitButton>保存する</SubmitButton>
            <LinkButton href={`/admin/actresses/${a.id}`} variant="ghost">キャンセル</LinkButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
