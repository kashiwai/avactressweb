"use client";
import { useSelfRecovery } from "../lib/self-recovery/useSelfRecovery";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  /* SOLOPTILINK-SELF-RECOVERY:BEGIN 自己回復のふるまいを合流 (画面表示は変更していません) */
  useSelfRecovery(undefined, reset);
  /* SOLOPTILINK-SELF-RECOVERY:END */
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-lg font-bold">表示中に問題が発生しました</h1>
      <p className="mt-2 text-sm text-muted">一時的な不具合の可能性があります。もう一度お試しいただき、解決しない場合は時間をおいてアクセスしてください。</p>
      <button onClick={reset} className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm text-white">もう一度読み込む</button>
    </main>
  );
}
