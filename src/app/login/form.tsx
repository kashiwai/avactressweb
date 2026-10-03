"use client";
import { login } from "@/lib/actions/public";
import { Field } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/client";

export function LoginForm() {
  return (
    <ActionForm action={login} className="mt-4 space-y-4">
      <Field label="メールアドレス" name="email" type="email" required autoComplete="username" />
      <Field label="パスワード" name="password" type="password" required autoComplete="current-password" />
      <SubmitButton className="w-full">ログイン</SubmitButton>
    </ActionForm>
  );
}
