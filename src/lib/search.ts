// サイト内検索（女優・店舗・地域）。公開してよいものだけを返す
import "server-only";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { actresses, enrollments, shops } from "@/db/schema";
import { PREFECTURES, prefName } from "./prefectures";
import { GENRES } from "./genres";

/** カタカナ→ひらがな・全角英数→半角・前後空白除去 */
export function normalizeQuery(q: string): string {
  return q
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .trim()
    .slice(0, 50);
}

export type SearchResult = {
  actresses: Array<{ id: number; name: string; kana: string; imageUrl: string }>;
  shops: Array<{ id: number; name: string; pref: string; area: string; genre: string }>;
  areas: Array<{ href: string; label: string }>;
};

export async function siteSearch(raw: string, limit = 6): Promise<SearchResult> {
  const q = normalizeQuery(raw);
  if (!q) return { actresses: [], shops: [], areas: [] };
  const like = `%${q}%`;
  const likeRaw = `%${raw.normalize("NFKC").trim().slice(0, 50)}%`;

  const [a, s] = await Promise.all([
    db
      .selectDistinct({ id: actresses.id, name: actresses.name, kana: actresses.kana, imageUrl: actresses.imageUrl })
      .from(actresses)
      .innerJoin(enrollments, and(eq(enrollments.actressId, actresses.id), eq(enrollments.status, "active")))
      .innerJoin(shops, and(eq(shops.id, enrollments.shopId), eq(shops.isPublished, true)))
      .where(and(eq(actresses.isPublished, true), eq(actresses.optedOut, false), or(ilike(actresses.name, likeRaw), ilike(actresses.kana, like))))
      .orderBy(asc(actresses.kana))
      .limit(limit),
    db
      .select({ id: shops.id, name: shops.name, prefCode: shops.prefCode, area: shops.area, genre: shops.genre })
      .from(shops)
      .where(and(eq(shops.isPublished, true), or(ilike(shops.name, likeRaw), ilike(shops.area, likeRaw))))
      .orderBy(sql`position(${likeRaw.slice(1, -1)} in ${shops.name})`, asc(shops.name))
      .limit(limit),
  ]);

  const areas: SearchResult["areas"] = [];
  const qq = raw.normalize("NFKC").trim();
  for (const p of PREFECTURES) {
    const short = p.name.replace(/[都府県]$/, "");
    if (qq && (p.name.includes(qq) || qq.includes(short))) {
      areas.push({ href: `/areas/${p.slug}`, label: `${p.name}の出勤情報` });
      for (const g of GENRES) if (qq.includes(g.name)) areas.unshift({ href: `/areas/${p.slug}/${g.slug}`, label: `${p.name}の${g.name}` });
    }
  }

  return {
    actresses: a,
    shops: s.map((x) => ({ id: x.id, name: x.name, pref: prefName(x.prefCode), area: x.area, genre: x.genre })),
    areas: areas.slice(0, 4),
  };
}
