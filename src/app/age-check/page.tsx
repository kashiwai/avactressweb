import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { confirmAge } from "@/lib/actions/public";
import { SITE_NAME } from "@/lib/site";
import { SubmitButton } from "@/components/client";

export const metadata: Metadata = { title: "年齢確認", robots: { index: false } };

export default async function AgeCheckPage({ searchParams }: PageProps<"/age-check">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
        <ShieldAlert className="mx-auto size-10 text-accent" aria-hidden />
        <h1 className="mt-4 text-xl font-bold">{SITE_NAME}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          このサイトには、風俗店・アダルト作品に関する情報が含まれます。
          <br />
          <strong className="text-foreground">18歳未満の方の閲覧は固くお断りします。</strong>
        </p>
        <form action={confirmAge} className="mt-6 space-y-3">
          <input type="hidden" name="next" value={next} />
          <SubmitButton className="w-full py-3">18歳以上です（入場する）</SubmitButton>
        </form>
        <a href="https://www.google.com/" className="mt-3 block w-full rounded-lg border border-line py-3 text-sm text-muted hover:text-foreground">
          18歳未満です（退場する）
        </a>
      </div>
    </main>
  );
}
