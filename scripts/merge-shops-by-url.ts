// 同じ公式URL（シティヘブンの店ページ）を持つ重複店舗を1つに統合する
//   bun --env-file=.env.local --conditions=react-server scripts/merge-shops-by-url.ts
//   ... --apply
import { db } from "../src/db";
import { enrollments, shops } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { mergeShopInto } from "../src/lib/ingest/merge";
import { cityheavenShopUrl } from "../src/lib/ingest/cityheaven-shop";

const apply = process.argv.includes("--apply");
const all = await db.select({ id: shops.id, name: shops.name, prefCode: shops.prefCode, officialUrl: shops.officialUrl }).from(shops);
const counts = new Map<number, number>();
for (const r of await db.select({ shopId: enrollments.shopId, n: sql<number>`count(*)::int` }).from(enrollments).groupBy(enrollments.shopId)) {
  counts.set(r.shopId, r.n);
}

const groups = new Map<string, typeof all>();
for (const s of all) {
  if (!/cityheaven\.net/.test(s.officialUrl)) continue;
  const key = cityheavenShopUrl(s.officialUrl).toLowerCase();
  groups.set(key, [...(groups.get(key) ?? []), s]);
}

let merged = 0;
for (const [url, list] of groups) {
  if (list.length < 2) continue;
  const sorted = [...list].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.id - b.id);
  const winner = sorted[0];
  console.log(`${url} -> #${winner.id} ${winner.name}（${list.length}店を統合）`);
  for (const loser of sorted.slice(1)) {
    if (apply) {
      if (await mergeShopInto(winner.id, loser.id)) merged++;
    } else merged++;
  }
}
console.log({ groups: [...groups.values()].filter((l) => l.length > 1).length, merged, apply });
process.exit(0);
