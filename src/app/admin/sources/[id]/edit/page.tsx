import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { dataSources } from "@/db/schema";
import { updateSource } from "@/lib/actions/admin";
import { shopOptions } from "@/lib/admin-options";
import { SourceFields } from "@/components/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditSourcePage({ params }: PageProps<"/admin/sources/[id]/edit">) {
  const id = Number((await params).id);
  const [d] = Number.isInteger(id) ? await db.select().from(dataSources).where(eq(dataSources.id, id)) : [];
  if (!d) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`${d.name} を編集`} />
      <Card className="p-5">
        <ActionForm action={updateSource}>
          <SourceFields source={d} shopOptions={await shopOptions()} />
          <div className="flex gap-2">
            <SubmitButton>保存する</SubmitButton>
            <LinkButton href={`/admin/sources/${d.id}`} variant="ghost">キャンセル</LinkButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
