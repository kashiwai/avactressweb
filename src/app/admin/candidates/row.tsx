import { ExternalLink, Store, X } from "lucide-react";
import type { CandidateGirl } from "@/db/schema";
import { ignoreCandidateAction, linkCandidateAction } from "@/lib/actions/admin";
import { prefName } from "@/lib/prefectures";
import { formatDateTimeJst } from "@/lib/dates";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/client";
import { Card, CheckboxField, SelectField } from "@/components/ui";

export function CandidateRow({ candidate: c, options }: { candidate: CandidateGirl; options: Array<{ id: number; name: string }> }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold">{c.displayName}</p>
          {c.note && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">{c.note}</p>}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1">
              <Store className="size-3.5" aria-hidden />
              {c.shopName}
            </span>
            <span>
              {prefName(c.prefCode)} {c.area}／{c.genre}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">最終確認：{formatDateTimeJst(c.lastSeenAt)}</p>
        </div>
        <a
          href={c.girlUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium hover:border-accent"
        >
          掲載ページを開いて確認
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
        <ActionForm action={linkCandidateAction} className="flex flex-1 flex-wrap items-end gap-3">
          <input type="hidden" name="candidateId" value={c.id} />
          <div className="min-w-56 flex-1">
            <SelectField
              label="結び付ける女優"
              name="actressId"
              required
              defaultValue=""
              options={[{ value: "", label: "選んでください" }, ...options.map((a) => ({ value: a.id, label: a.name }))]}
            />
          </div>
          <div className="min-w-64 flex-1">
            <CheckboxField
              label="掲載ページを確認しました"
              name="confirmed"
              hint="お店の掲載内容から、この女優ご本人と判断できる場合のみチェックしてください"
            />
          </div>
          <SubmitButton>結び付ける</SubmitButton>
        </ActionForm>
        <form action={ignoreCandidateAction}>
          <input type="hidden" name="candidateId" value={c.id} />
          <ConfirmSubmit variant="secondary" message={`「${c.displayName}」を対象外にします。次回以降の取り込みでは並びません。よろしいですか？`}>
            <X className="size-4" aria-hidden />
            対象外にする
          </ConfirmSubmit>
        </form>
      </div>
    </Card>
  );
}
