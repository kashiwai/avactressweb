// 管理画面の読み込み中の表示（押した直後に切り替わったことが分かるようにする）
export default function AdminLoading() {
  return (
    <div className="flex items-center gap-3 py-16 text-sm text-muted" role="status" aria-live="polite">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
      読み込んでいます…
    </div>
  );
}
