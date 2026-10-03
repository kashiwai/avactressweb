import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <p className="text-5xl font-bold text-accent">404</p>
      <h1 className="mt-3 text-lg font-bold">ページが見つかりません</h1>
      <p className="mt-2 text-sm text-muted">掲載が終了したか、URLが間違っている可能性があります。</p>
      <Link href="/" className="mt-5 text-sm text-accent underline">トップへ戻る</Link>
    </main>
  );
}
