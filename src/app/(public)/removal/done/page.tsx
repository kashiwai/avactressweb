import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "削除依頼を受け付けました" };

export default function RemovalDonePage() {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <CheckCircle2 className="mx-auto size-10 text-green-600" aria-hidden />
      <h1 className="mt-3 text-xl font-bold">削除のご依頼を受け付けました</h1>
      <p className="mt-2 text-sm text-muted">内容を確認のうえ、順次対応いたします。確認のためにご連絡することがあります。</p>
      <Link href="/" className="mt-5 inline-block text-sm text-accent underline">トップへ戻る</Link>
    </Card>
  );
}
