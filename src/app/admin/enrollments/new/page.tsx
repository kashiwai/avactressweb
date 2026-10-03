import { createEnrollment } from "@/lib/actions/admin";
import { actressOptions, shopOptions } from "@/lib/admin-options";
import { EnrollmentFields } from "@/components/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewEnrollmentPage({ searchParams }: PageProps<"/admin/enrollments/new">) {
  const sp = await searchParams;
  const [a, s] = await Promise.all([actressOptions(), shopOptions()]);
  if (a.length === 0 || s.length === 0) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="在籍を登録" />
        <EmptyState
          title="先に女優と店舗を登録してください"
          description="在籍は「女優」と「店舗」の組み合わせで登録します。"
          action={<div className="flex gap-2"><LinkButton href="/admin/actresses/new" variant="secondary">女優を登録</LinkButton><LinkButton href="/admin/shops/new" variant="secondary">店舗を登録</LinkButton></div>}
        />
      </div>
    );
  }
  return (
    <div className="max-w-3xl">
      <PageHeader title="在籍を登録" description="お店が公表している在籍だけを登録してください。根拠となるページのURLが必須です。" />
      <Card className="p-5">
        <ActionForm action={createEnrollment}>
          <EnrollmentFields actressOptions={a} shopOptions={s} preset={{ actressId: Number(sp.actress) || undefined, shopId: Number(sp.shop) || undefined }} />
          <div className="flex gap-2">
            <SubmitButton>登録する</SubmitButton>
            <LinkButton href="/admin/enrollments" variant="ghost">キャンセル</LinkButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
