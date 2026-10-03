import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "利用規約" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="利用規約" />
      <Card className="space-y-4 p-5 text-sm leading-relaxed">
        <p>本規約は、{SITE_NAME}（以下「当サイト」）の利用条件を定めるものです。当サイトを利用した時点で、本規約に同意したものとみなします。</p>
        <h2 className="font-bold">第1条（対象）</h2>
        <p>当サイトは18歳以上の方を対象とします。18歳未満の方は利用できません。</p>
        <h2 className="font-bold">第2条（掲載情報）</h2>
        <p>掲載情報は各店舗の公表内容に基づきますが、正確性・最新性を保証するものではありません。出勤状況などは必ず各店舗へ直接ご確認ください。</p>
        <h2 className="font-bold">第3条（禁止事項）</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>掲載されている方への付きまとい、待ち伏せ、誹謗中傷その他の迷惑行為</li>
          <li>当サイトの情報の無断転載、自動取得（スクレイピング）、再配布</li>
          <li>当サイトの運営を妨げる行為、法令または公序良俗に反する行為</li>
        </ul>
        <h2 className="font-bold">第4条（外部サイト）</h2>
        <p>当サイトから移動した外部サイト（店舗・アフィリエイト先を含む）での取引等について、当サイトは責任を負いません。</p>
        <h2 className="font-bold">第5条（免責・変更）</h2>
        <p>当サイトは予告なく内容を変更・停止することがあります。本規約は必要に応じて改定し、当ページに掲載した時点で効力を生じます。</p>
      </Card>
    </div>
  );
}
