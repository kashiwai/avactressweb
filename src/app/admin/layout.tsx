import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { CalendarDays, FileWarning, History, LayoutDashboard, RefreshCw, Store, UserCog, UserSearch, Users } from "lucide-react";
import { db } from "@/db";
import { candidateGirls, removalRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { StaffShell } from "@/components/staff-shell";

export const metadata: Metadata = { title: "運営者管理画面", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const u = await requireAdmin();
  const [[r], [c]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(removalRequests).where(eq(removalRequests.status, "new")),
    db.select({ n: sql<number>`count(*)::int` }).from(candidateGirls).where(eq(candidateGirls.status, "pending")),
  ]);
  return (
    <StaffShell
      title="運営者管理画面"
      userLabel={`${u.displayName || u.email}（運営者）`}
      nav={[
        { href: "/admin", label: "ダッシュボード", icon: LayoutDashboard },
        { href: "/admin/actresses", label: "女優", icon: Users },
        { href: "/admin/shops", label: "店舗", icon: Store },
        { href: "/admin/enrollments", label: "在籍・出勤", icon: CalendarDays },
        { href: "/admin/candidates", label: "確認待ち", icon: UserSearch, badge: c?.n ?? 0 },
        { href: "/admin/sources", label: "取り込み元", icon: RefreshCw },
        { href: "/admin/removals", label: "削除依頼", icon: FileWarning, badge: r?.n ?? 0 },
        { href: "/admin/users", label: "アカウント", icon: UserCog },
        { href: "/admin/audit", label: "操作記録", icon: History },
      ]}
    >
      {children}
    </StaffShell>
  );
}
