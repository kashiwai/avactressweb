// 年齢確認と管理画面の入口チェック（本当の権限確認は各画面・各処理の中で行う）
import { NextResponse, type NextRequest } from "next/server";

export const AGE_COOKIE = "age_ok";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isStaffArea = pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/shop" || pathname.startsWith("/shop/");
  if (isStaffArea) {
    if (!request.cookies.get("sid")) {
      const url = new URL("/login", request.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 年齢確認なしで見られる画面
  const open =
    pathname === "/age-check" ||
    pathname === "/login" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/removal" ||
    pathname.startsWith("/removal/");
  if (open) return NextResponse.next();

  if (request.cookies.get(AGE_COOKIE)?.value !== "1") {
    const url = new URL("/age-check", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
