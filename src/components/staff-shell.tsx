// 管理画面の枠（左固定メニュー＋上部バー）。運営者・お店で共用
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ExternalLink, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logout } from "@/lib/actions/public";
import { SITE_NAME } from "@/lib/site";
import { Toast } from "./client";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

export function StaffShell({ title, nav, userLabel, children }: { title: string; nav: NavItem[]; userLabel: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">AV</span>
          <div className="leading-tight">
            <div className="text-sm font-bold">{SITE_NAME}</div>
            <div className="text-xs text-muted">{title}</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible" aria-label="管理メニュー">
          {nav.map(({ href, label, icon: Icon, badge }) => (
            <Link key={href} href={href} className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground">
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{label}</span>
              {badge ? <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-white">{badge}</span> : null}
            </Link>
          ))}
          <Link href="/" target="_blank" className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground md:mt-4">
            <ExternalLink className="size-4 shrink-0" aria-hidden />
            公開サイトを見る
          </Link>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-line px-4 py-2.5 text-sm">
          <span className="truncate text-muted">{userLabel}</span>
          <form action={logout}>
            <button type="submit" className="flex items-center gap-1 rounded-lg px-2 py-1 text-muted hover:bg-surface-2 hover:text-foreground">
              <LogOut className="size-4" aria-hidden />
              ログアウト
            </button>
          </form>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
      <Suspense>
        <Toast />
      </Suspense>
    </div>
  );
}
