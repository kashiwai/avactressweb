// 既存データの名寄せ（女優名・店名）と、女優名でない行の整理
//
// 使い方:
//   bun --env-file=.env.local --conditions=react-server scripts/clean-merge.ts            # 確認だけ（書き込みなし）
//   bun --env-file=.env.local --conditions=react-server scripts/clean-merge.ts --apply    # 実際に統合・非公開化する
//
//  - 「FC2-PPV-123456」のような品番だけの女優名は、公開一覧に出ないよう is_published=false にする
//  - 表記ゆれ（全角/半角・空白・カタカナ/ひらがな）だけが違う女優は、在籍の多い方を残して1人に統合する
//  - 同じ都道府県で表記ゆれだけが違う店舗は1店に統合する（在籍・出勤は残す）
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { isPlausibleActressName, normalizePersonName, normalizeShopName } from "../src/lib/ingest/normalize";
import { mergeActressInto, mergeShopInto } from "../src/lib/ingest/merge";

const { actresses, enrollments, shops } = schema;
const apply = process.argv.includes("--apply");
const url = process.env.DATABASE_URL!;
const client = postgres(url, { max: 1, prepare: !/:6543\//.test(url) });
const db = drizzle(client, { schema });

const as = await db.select({ id: actresses.id, name: actresses.name, kana: actresses.kana, isPublished: actresses.isPublished }).from(actresses);
const es = await db.select({ actressId: enrollments.actressId, shopId: enrollments.shopId, status: enrollments.status }).from(enrollments);
const ss = await db.select({ id: shops.id, name: shops.name, prefCode: shops.prefCode }).from(shops);

const count = new Map<number, number>();
for (const e of es) count.set(e.actressId, (count.get(e.actressId) ?? 0) + 1);
const best = (ids: number[]) => [...ids].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0) || a - b)[0];

// 1) 女優名でない行
const junk = as.filter((a) => !isPlausibleActressName(a.name));
console.log(`女優名でない行: ${junk.length}`);
for (const a of junk.slice(0, 40)) console.log(`  #${a.id} ${a.name}（在籍${count.get(a.id) ?? 0}件）${a.isPublished ? "" : " 非公開済"}`);
if (apply) for (const a of junk) if (a.isPublished) await db.update(actresses).set({ isPublished: false, updatedAt: new Date() }).where(eq(actresses.id, a.id));

// 2) 女優の重複（表記ゆれだけ）
const byName = new Map<string, number[]>();
for (const a of as) {
  if (!isPlausibleActressName(a.name)) continue;
  const k = normalizePersonName(a.name);
  if (k.length < 2) continue;
  byName.set(k, [...(byName.get(k) ?? []), a.id]);
}
let actressMerged = 0;
for (const ids of byName.values()) {
  if (ids.length < 2) continue;
  const winner = best(ids);
  for (const loser of ids) {
    if (loser === winner) continue;
    if (apply) {
      if (await mergeActressInto(winner, loser)) actressMerged++;
    } else actressMerged++;
  }
}
console.log(`女優の重複: ${[...byName.values()].filter((ids) => ids.length > 1).length}組（${apply ? `${actressMerged}件を統合` : "確認のみ"}）`);

// 3) 店舗の重複（同じ都道府県＋表記ゆれだけ）
const byShop = new Map<string, number[]>();
for (const s of ss) {
  const k = normalizeShopName(s.name);
  if (k.length < 2) continue;
  const key = `${s.prefCode}|${k}`;
  byShop.set(key, [...(byShop.get(key) ?? []), s.id]);
}
let shopMerged = 0;
for (const ids of byShop.values()) {
  if (ids.length < 2) continue;
  const winner = ids[0];
  for (const loser of ids.slice(1)) {
    if (apply) {
      if (await mergeShopInto(winner, loser)) shopMerged++;
    } else shopMerged++;
  }
}
console.log(`店舗の重複: ${[...byShop.values()].filter((ids) => ids.length > 1).length}組（${apply ? `${shopMerged}件を統合` : "確認のみ"}）`);

console.log(apply ? "反映しました" : "確認のみ（--apply で反映）");
await client.end();
