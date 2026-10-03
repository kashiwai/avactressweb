import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { formatDateTimeJst } from "@/lib/dates";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  login: "ログイン",
  "shop.create": "店舗登録", "shop.update": "店舗編集", "shop.delete": "店舗削除", "shop.anonymous_count": "非公開在籍数の更新",
  "actress.create": "女優登録", "actress.update": "女優編集", "actress.delete": "女優削除", "actress.optout": "掲載停止", "actress.optin": "掲載再開",
  "link.create": "リンク追加", "link.toggle": "リンク表示切替", "link.delete": "リンク削除",
  "enrollment.create": "在籍登録", "enrollment.update": "在籍編集", "enrollment.delete": "在籍削除", "enrollment.reverify": "根拠の再確認",
  "schedule.save": "出勤保存", "schedule.copy_week": "先週の出勤を複写",
  "source.create": "取り込み元登録", "source.update": "取り込み元編集", "source.delete": "取り込み元削除", "source.run": "取り込み手動実行",
  "removal.update": "削除依頼の対応", "user.create": "アカウント作成", "user.reset_password": "パスワード再設定", "user.delete": "アカウント削除",
};

export default async function AuditPage() {
  const rows = await db.select({ l: auditLogs, email: users.email }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.userId)).orderBy(desc(auditLogs.createdAt)).limit(200);
  return (
    <div>
      <PageHeader title="操作記録" description="誰が・いつ・何を変更したかの記録（新しい順に200件）" />
      {rows.length === 0 ? <EmptyState title="記録はまだありません" /> : (
        <Table>
          <thead><tr><Th>日時</Th><Th>操作者</Th><Th>操作</Th><Th>対象</Th><Th>内容</Th></tr></thead>
          <tbody>
            {rows.map(({ l, email }) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap">{formatDateTimeJst(l.createdAt)}</Td>
                <Td>{email ?? "（削除済み）"}</Td>
                <Td>{ACTION_LABEL[l.action] ?? l.action}</Td>
                <Td className="text-xs text-muted">{l.target}</Td>
                <Td className="max-w-xs truncate text-xs">{l.detail}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
