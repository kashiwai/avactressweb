import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { CalendarDays } from "lucide-react";
import { db } from "@/db";
import { shops } from "@/db/schema";
import { requireShop } from "@/lib/auth";
import { StaffShell } from "@/components/staff-shell";

export const metadata: Metadata = { title: "お店用管理画面", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: LayoutProps<"/shop">) {
  const u = await requireShop();
  const [s] = await db.select({ name: shops.name }).from(shops).where(eq(shops.id, u.shopId));
  return (
    <StaffShell title={`お店用：${s?.name ?? ""}`} userLabel={u.displayName || u.email} nav={[{ href: "/shop", label: "在籍と出勤", icon: CalendarDays }]}>
      {children}
    </StaffShell>
  );
}
