import StatusBeacon from "../components/soloptilink/StatusBeacon";
import ChunkRecovery from "../lib/self-recovery/ChunkRecovery";
import ConnectionGuard from "../lib/self-recovery/ConnectionGuard";
import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} | AV女優・セクシー女優の風俗出勤情報`, template: `%s | ${SITE_NAME}` },
  description: "風俗店に在籍するAV女優・セクシー女優の出勤日・休みを、女優・店舗・地域ごとに毎日更新。お店が公表している情報だけを掲載しています。",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // ブラウザ拡張（UI.Vision 等）が <html> に属性を足しても警告を出さない（この要素の属性のみが対象）
    <html lang="ja" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {/* SOLOPTILINK-STATUS-BEACON:BEGIN 生成物の状態表示(自動注入・この区間は削除しないでください) */}
        <StatusBeacon />
        {/* SOLOPTILINK-STATUS-BEACON:END */}
        {/* SOLOPTILINK-SELF-RECOVERY:BEGIN 自己回復部品(自動注入・この区間は削除しないでください) */}
        <ChunkRecovery />
        <ConnectionGuard />
        {/* SOLOPTILINK-SELF-RECOVERY:END */}{children}</body>
    </html>
  );
}
