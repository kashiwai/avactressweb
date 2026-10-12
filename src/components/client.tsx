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

/**
 * 画面切り替えの進行バー。リンクや検索（GETのフォーム）を押した瞬間に画面上部へ表示し、
 * 切り替え先の画面が出たら消す。8秒を超えたら「時間がかかっています」と知らせる。
 * （保存・削除などのボタンは SubmitButton / ActionForm 側で送信中を表示する）
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [slow, setSlow] = useState(false);

  // URLが変わった＝切り替え完了
  useEffect(() => {
    setActive(false);
    setSlow(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Next.js のリンクは画面内で切り替えるために既定動作を打ち消すので、defaultPrevented は見ない
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setActive(true);
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || e.defaultPrevented) return;
      if ((form.getAttribute("method") ?? "get").toLowerCase() === "get") setActive(true);
    };
    // 戻る・進むでも切り替わる
    const onPop = () => setActive(true);
    // リンク側の処理より先に受け取るため、捕捉段階で登録する
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!active) return null;
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[2147483640] h-1 overflow-hidden bg-accent/20" role="progressbar" aria-label="読み込み中">
        <div className="h-full w-1/3 animate-[navprogress_1.1s_ease-in-out_infinite] bg-accent" />
      </div>
      {slow && (
        <div role="status" aria-live="polite" className="fixed left-1/2 top-3 z-[2147483640] -translate-x-1/2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs text-muted shadow">
          読み込みに時間がかかっています。そのままお待ちください…
        </div>
      )}
    </>
  );
}
