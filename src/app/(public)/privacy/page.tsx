import type { Metadata } from "next";
import { OPERATOR_CONTACT, SITE_NAME } from "@/lib/site";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "プライバシーポリシー" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="プライバシーポリシー" />
      <Card className="space-y-4 p-5 text-sm leading-relaxed">
        <p>{SITE_NAME}は、個人情報保護法に基づき、以下のとおり個人情報を取り扱います。</p>
        <h2 className="font-bold">1. 取得する情報と利用目的</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>削除依頼フォームのお名前・ご連絡先・ご依頼内容：削除依頼への対応と、そのためのご連絡にのみ利用します。</li>
          <li>店舗アカウントのメールアドレス：ログインと運営上のご連絡に利用します。</li>
          <li>Cookie：年齢確認の結果とログイン状態の保持に利用します。</li>
        </ul>
        <h2 className="font-bold">2. 第三者提供</h2>
        <p>法令に基づく場合を除き、ご本人の同意なく第三者へ提供しません。</p>
        <h2 className="font-bold">3. アフィリエイト</h2>
        <p>当サイトはアフィリエイトプログラムを利用しています。広告リンクをクリックすると、提携先がCookie等で成果を計測することがあります。</p>
        <h2 className="font-bold">4. 開示・訂正・削除のご請求</h2>
        <p>ご本人からの開示・訂正・利用停止のご請求には、法令に従い対応します。お問い合わせ先：{OPERATOR_CONTACT || "（準備中）"}</p>
      </Card>
    </div>
  );
}
