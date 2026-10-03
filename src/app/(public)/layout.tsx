import Link from "next/link";
import { Suspense } from "react";
import { CalendarHeart, MapPin, Store, Users } from "lucide-react";
import { SITE_NAME } from "@/lib/site";
import { Toast } from "@/components/client";
import { SearchBox } from "@/components/search-box";

const NAV = [
  { href: "/", label: "本日出勤", icon: CalendarHeart },
  { href: "/actresses", label: "女優から探す", icon: Users },
  { href: "/shops", label: "店舗から探す", icon: Store },
  { href: "/areas", label: "地域から探す", icon: MapPin },
];

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-bold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-sm text-white">AV</span>
            <span className="hidden lg:inline">{SITE_NAME}</span>
          </Link>
          <div className="hidden min-w-0 flex-1 sm:block">
            <SearchBox />
          </div>
          <nav className="ml-auto flex shrink-0 gap-1 overflow-x-auto text-sm sm:ml-0" aria-label="メインメニュー">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
                <Icon className="size-4" aria-hidden />
                <span className="hidden md:inline">{label}</span>
                <span className="md:hidden">{label.replace("から探す", "")}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="px-4 pb-3 sm:hidden">
          <SearchBox />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 text-sm text-muted sm:grid-cols-2">
          <div>
            <p className="font-bold text-foreground">{SITE_NAME}</p>
            <p className="mt-2 text-xs leading-relaxed">
              掲載しているのは、各店舗が公表している在籍・出勤情報と、掲載の許可を得た情報サイトの情報です。最新の出勤状況は必ず各店舗へご確認ください。本サイトは18歳未満の方の閲覧を禁止しています。当サイトにはアフィリエイト広告（PR）が含まれます。
            </p>
          </div>
          <nav className="flex flex-wrap content-start gap-x-4 gap-y-2 sm:justify-end" aria-label="フッターメニュー">
            <Link href="/about" className="hover:text-foreground">掲載方針・運営者</Link>
            <Link href="/removal" className="hover:text-foreground">掲載削除のご依頼</Link>
            <Link href="/terms" className="hover:text-foreground">利用規約</Link>
            <Link href="/privacy" className="hover:text-foreground">プライバシーポリシー</Link>
            <Link href="/login" className="hover:text-foreground">店舗・運営者ログイン</Link>
          </nav>
        </div>
      </footer>
      <Suspense>
        <Toast />
      </Suspense>
    </>
  );
}
