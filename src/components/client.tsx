"use client";
// 画面側で動く小さな部品（確認ダイアログ・送信中表示・完了通知）
import { startTransition, useActionState, useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, X } from "lucide-react";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60";
const variants = {
  primary: "bg-accent text-white hover:bg-rose-700",
  secondary: "bg-surface-2 text-foreground border border-line hover:bg-gray-200",
  danger: "bg-red-50 text-red-700 border border-red-500/30 hover:bg-red-100",
} as const;

/** 送信中は押せなくなる送信ボタン */
export function SubmitButton({ children, variant = "primary", className = "" }: { children: ReactNode; variant?: keyof typeof variants; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${base} ${variants[variant]} ${className}`}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** 押すと確認ダイアログを出し、OKのときだけ送信する（削除などに使う） */
export function ConfirmSubmit({ children, message, variant = "danger", className = "" }: { children: ReactNode; message: string; variant?: keyof typeof variants; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${base} ${variants[variant]} ${className}`}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export type ActionState = { error?: string } | undefined;

/**
 * サーバー処理につなぐフォーム。エラー時は上部に日本語で表示し、入力内容は消さない
 * （成功時はサーバー側で一覧などへ移動する）
 */
export function ActionForm({
  action,
  children,
  className = "space-y-4",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <fieldset disabled={pending} className={`m-0 min-w-0 border-0 p-0 ${className}`}>
        {state?.error && (
          <div role="alert" className="rounded-lg border border-red-500/40 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}
        {children}
      </fieldset>
    </form>
  );
}

/** URLの ?msg= を読み取って右下に完了通知を出す */
export function Toast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const msg = params.get("msg");
  const [shown, setShown] = useState<string | null>(null);
  const [seen, setSeen] = useState<string | null>(null);

  // 新しい通知が来たら表示する（描画中に前回値と比べて更新する React 推奨の書き方）
  if (msg && msg !== seen) {
    setSeen(msg);
    setShown(msg);
  }

  useEffect(() => {
    if (!msg) return;
    // URL から通知文を取り除き、再読み込みで二重に出ないようにする
    const rest = new URLSearchParams(params.toString());
    rest.delete("msg");
    const q = rest.toString();
    // ページを再取得しない履歴の置き換え（再取得すると通知部品が作り直されて消えるため）
    window.history.replaceState(null, "", q ? `${pathname}?${q}` : pathname);
  }, [msg, params, pathname]);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => {
      setShown(null);
      setSeen(null);
    }, 3500);
    return () => clearTimeout(t);
  }, [shown]);

  if (!shown) return null;
  return (
    <div role="status" className="animate-toast fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-2 rounded-lg border border-green-500/40 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-lg">
      <CheckCircle2 className="size-4 shrink-0 text-green-600" aria-hidden />
      <span>{shown}</span>
      <button type="button" onClick={() => setShown(null)} className="ml-2 text-green-700 hover:text-white" aria-label="閉じる">
        <X className="size-4" />
      </button>
    </div>
  );
}
