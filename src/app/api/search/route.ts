// 検索窓の候補（軽量・短時間キャッシュ）
import { siteSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  if (!/(?:^|;\s*)age_ok=1(?:;|$)/.test(cookie)) return Response.json({ actresses: [], shops: [], areas: [] });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const result = await siteSearch(q, 6);
  return Response.json(result, { headers: { "Cache-Control": "private, max-age=30" } });
}
