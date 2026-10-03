import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { enrollments } from "@/db/schema";
import { updateEnrollment } from "@/lib/actions/admin";
import { actressOptions, shopOptions } from "@/lib/admin-options";
import { EnrollmentFields } from "@/components/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditEnrollmentPage({ params }: PageProps<"/admin/enrollments/[id]/edit">) {
  const id = Number((await params).id);
  const [e] = Number.isInteger(id) ? await db.select().from(enrollments).where(eq(enrollments.id, id)) : [];
  if (!e) notFound();
  const [a, s] = await Promise.all([actressOptions(), shopOptions()]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="在籍を編集" />
      <Card className="p-5">
        <ActionForm action={updateEnrollment}>
          <EnrollmentFields enrollment={e} actressOptions={a} shopOptions={s} />
          <div className="flex gap-2">
            <SubmitButton>保存する</SubmitButton>
            <LinkButton href={`/admin/enrollments/${e.id}`} variant="ghost">キャンセル</LinkButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
