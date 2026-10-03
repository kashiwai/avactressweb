import Link from "next/link";
import type { Metadata } from "next";
import { OPERATOR_CONTACT, OPERATOR_NAME, SITE_NAME } from "@/lib/site";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "掲載方針・運営者" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="掲載方針・運営者情報" />
      <Card className="space-y-4 p-5 text-sm leading-relaxed">
        <h2 className="text-base font-bold">掲載する情報について</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>掲載するのは、各店舗が<strong>公表している</strong>AV女優・セクシー女優の在籍情報と出勤予定です。在籍情報ごとに、公表元または取得元のページを記録しています。</li>
          <li>店舗が名前を伏せている在籍者は「AV女優在籍（名前非公開）」として人数のみを表示し、個人を特定する情報は掲載しません。顔写真の照合などによる推測での掲載は行いません。</li>
          <li>出勤予定は、店舗からご提供いただいたデータ、店舗ご自身による入力、および運営者から取得の許可を得た情報サイト・公式サイトの情報をもとに毎日更新しています。各在籍情報には取得元のページを明記しています。</li>
          <li>ご本人・所属事務所・店舗から削除のご依頼があった場合は、確認のうえ速やかに掲載を停止します。<Link href="/removal" className="text-accent underline">削除依頼フォーム</Link>からご連絡ください。</li>
          <li>当サイトは DMM アフィリエイト等のアフィリエイトプログラムに参加しており、「PR」と表示したリンクは広告です。</li>
        </ol>
      </Card>
      <Card className="space-y-2 p-5 text-sm">
        <h2 className="text-base font-bold">運営者</h2>
        <dl className="grid grid-cols-[6rem_1fr] gap-y-2">
          <dt className="text-muted">サイト名</dt>
          <dd>{SITE_NAME}</dd>
          <dt className="text-muted">運営者</dt>
          <dd>{OPERATOR_NAME || "（準備中）"}</dd>
          <dt className="text-muted">お問い合わせ</dt>
          <dd>{OPERATOR_CONTACT || "（準備中）"}</dd>
        </dl>
      </Card>
    </div>
  );
}
