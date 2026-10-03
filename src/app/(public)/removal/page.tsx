import type { Metadata } from "next";
import { listActressNamesForRemoval } from "@/lib/queries";
import { PageHeader, Card } from "@/components/ui";
import { RemovalForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "掲載削除のご依頼" };

export default async function RemovalPage({ searchParams }: PageProps<"/removal">) {
  const sp = await searchParams;
  const names = await listActressNamesForRemoval();
  const pre = typeof sp.actress === "string" ? sp.actress : "";
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="掲載削除のご依頼" description="ご本人・所属事務所・店舗の方からのご依頼を受け付けています。" />
      <Card className="mb-5 p-4 text-sm leading-relaxed text-muted">
        ご本人・事務所からのご依頼は、内容を確認できしだい該当ページの掲載を停止します。確認のため、ご記入の連絡先へご連絡することがあります。いただいた情報は削除対応のためだけに使います。
      </Card>
      <RemovalForm actresses={names} preselect={pre} />
    </div>
  );
}
