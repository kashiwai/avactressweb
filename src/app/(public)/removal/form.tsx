"use client";
import { submitRemoval } from "@/lib/actions/public";
import { Field, SelectField, TextAreaField } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/client";

export function RemovalForm({ actresses, preselect }: { actresses: Array<{ id: number; name: string }>; preselect: string }) {
  return (
    <ActionForm action={submitRemoval} className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <SelectField
        label="ご依頼者の区分"
        name="requesterType"
        required
        defaultValue="actress"
        options={[
          { value: "actress", label: "ご本人" },
          { value: "agency", label: "所属事務所" },
          { value: "shop", label: "店舗" },
          { value: "other", label: "その他" },
        ]}
      />
      <Field label="お名前（ご担当者名）" name="requesterName" required maxLength={100} autoComplete="name" />
      <Field label="ご連絡先（メールアドレスまたは電話番号）" name="contact" required maxLength={200} autoComplete="email" />
      <SelectField
        label="対象の女優（一覧にある場合）"
        name="targetActressId"
        defaultValue={preselect}
        options={[{ value: "", label: "選択しない" }, ...actresses.map((a) => ({ value: a.id, label: a.name }))]}
      />
      <Field label="対象のページURLまたは女優名・店舗名" name="targetText" required maxLength={500} />
      <TextAreaField label="ご依頼の理由・内容" name="reason" required maxLength={2000} />
      {/* ボット対策（人には見えない欄） */}
      <div className="hidden" aria-hidden>
        <label>
          ウェブサイト
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <SubmitButton>依頼を送信する</SubmitButton>
    </ActionForm>
  );
}
