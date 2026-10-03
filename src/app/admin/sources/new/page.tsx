import { createSource } from "@/lib/actions/admin";
import { shopOptions } from "@/lib/admin-options";
import { SourceFields } from "@/components/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { FeedFormatHelp } from "../help";

export const dynamic = "force-dynamic";

export default async function NewSourcePage() {
  const s = await shopOptions();
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="取り込み元を登録" />
      {s.length === 0 ? (
        <EmptyState title="先に店舗を登録してください" action={<LinkButton href="/admin/shops/new">店舗を登録</LinkButton>} />
      ) : (
        <Card className="p-5">
          <ActionForm action={createSource}>
            <SourceFields shopOptions={s} />
            <div className="flex gap-2">
              <SubmitButton>登録する</SubmitButton>
              <LinkButton href="/admin/sources" variant="ghost">キャンセル</LinkButton>
            </div>
          </ActionForm>
        </Card>
      )}
      <FeedFormatHelp />
    </div>
  );
}
