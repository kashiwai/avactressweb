// 女優の画像を全員分そろえるバックフィル。
//   1) DUGAの女優一覧（名前・よみがな・女優ID・顔写真）から照合
//   2) 1で見つからない人をDUGA検索APIで照合（名前・別名・よみがな）
//   3) それでも無い人は、取り込み元ページの女優画像（og:image）を表示用に保存
//
// 使い方:
//   bun --env-file=.env.local --conditions=react-server scripts/backfill-photos.ts            # 確認のみ
//   bun --env-file=.env.local --conditions=react-server scripts/backfill-photos.ts --apply    # 反映
//   ... --limit=100 / --skip-api / --skip-source / --include-jacket
import { db } from "../src/db";
import { actresses, enrollments } from "../src/db/schema";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { buildDugaIndex, fetchDugaActressIndex, matchDugaIndex } from "../src/lib/duga-index";
import { searchDuga } from "../src/lib/duga";
import { dugaFaceCheck } from "../src/lib/dmm-fill";
import { dmmConfigured, searchDmmActress } from "../src/lib/dmm";
import { normalizePersonName, splitPersonNames } from "../src/lib/ingest/normalize";
import { imageByAlt, ogImage, firstDmmImage } from "../src/lib/ingest/html";

const apply = process.argv.includes("--apply");
const skipApi = process.argv.includes("--skip-api");
const skipSource = process.argv.includes("--skip-source");
const skipDmm = process.argv.includes("--skip-dmm");
const includeJacket = process.argv.includes("--include-jacket");
const missingOnly = process.argv.includes("--missing-only");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const noImage = missingOnly
  ? and(eq(actresses.imageUrl, ""), eq(actresses.sourceImageUrl, ""))
  : or(eq(actresses.imageUrl, ""), includeJacket ? sql`${actresses.imageUrl} like '%pic.duga.jp/%/jacket%'` : sql`false`);

const rows = await db
  .select({ id: actresses.id, name: actresses.name, kana: actresses.kana, aliases: actresses.aliases, imageUrl: actresses.imageUrl })
  .from(actresses)
  .where(and(noImage, eq(actresses.isPublished, true)))
  .orderBy(asc(actresses.id))
  .limit(limit > 0 ? limit : 100000);
console.log(`対象 ${rows.length}人（${apply ? "反映" : "確認のみ"}）`);

const done = new Set<number>();
let byIndex = 0, byApi = 0, byDmm = 0, bySource = 0, noPhoto = 0, fails = 0;

// 1) DUGA 女優一覧
console.log("DUGA女優一覧を読み込み中…");
const performers = await fetchDugaActressIndex();
const index = buildDugaIndex(performers);
console.log(`DUGA女優一覧 ${performers.length}人`);
for (const a of rows) {
  const r = matchDugaIndex(a, index);
  if (r.kind !== "matched") continue;
  const p = r.match.performer;
  if (!p.imageUrl) { noPhoto++; continue; }
  if (apply) {
    await db
      .update(actresses)
      .set({
        imageUrl: p.imageUrl,
        dugaPerformerId: p.id,
        dugaCheckedAt: new Date(),
        ...(a.kana ? {} : (p.kana ? { kana: p.kana } : {})),
        updatedAt: new Date(),
      })
      .where(eq(actresses.id, a.id));
  }
  done.add(a.id);
  byIndex++;
  if (byIndex % 100 === 0) console.log(`  一覧で ${byIndex}人`);
}

// 2) DUGA 検索API（一覧に載っていない人）
if (!skipApi) {
  const rest = rows.filter((a) => !done.has(a.id));
  console.log(`DUGA検索APIで照合中… 残り ${rest.length}人`);
  for (const a of rest) {
    const parsed = splitPersonNames(a.name);
    const keys = new Set([parsed.name, ...a.aliases, ...parsed.aliases, a.kana].map(normalizePersonName).filter((k) => k.length >= 2));
    let hit: { id: string; name: string; kana: string } | null = null;
    for (const kw of [a.name, a.kana, ...a.aliases].filter(Boolean).slice(0, 3)) {
      let res;
      try {
        res = await searchDuga(kw, { hits: 50, sort: "favorite", cache: "none" });
      } catch {
        fails++;
        break;
      }
      if (!res.ok) { fails++; break; }
      const cands = new Map<string, { id: string; name: string; kana: string }>();
      for (const it of res.items) for (const p of it.performers) {
        if (keys.has(normalizePersonName(p.name)) || (p.kana && keys.has(normalizePersonName(p.kana)))) cands.set(p.id, p);
      }
      const list = [...cands.values()];
      if (list.length === 1) { hit = list[0]; break; }
      if (list.length > 1) break;
      await sleep(1100);
    }
    if (hit) {
      const face = await dugaFaceCheck(hit.id);
      if (face.url) {
        if (apply) {
          await db
            .update(actresses)
            .set({
              imageUrl: face.url,
              dugaPerformerId: hit.id,
              dugaCheckedAt: new Date(),
              ...(a.kana ? {} : (hit.kana ? { kana: hit.kana } : {})),
              updatedAt: new Date(),
            })
            .where(eq(actresses.id, a.id));
        }
        done.add(a.id);
        byApi++;
        if (byApi % 50 === 0) console.log(`  APIで ${byApi}人`);
      } else noPhoto++;
    }
    await sleep(1100);
  }
}


// 2.5) DMM 女優検索（APIキーがある場合）
if (!skipDmm && dmmConfigured()) {
  const rest = rows.filter((a) => !done.has(a.id));
  console.log(`DMM女優検索で照合中… 残り ${rest.length}人`);
  for (const a of rest) {
    const parsed = splitPersonNames(a.name);
    const keys = new Set([parsed.name, ...a.aliases, ...parsed.aliases].map(normalizePersonName).filter((k) => k.length >= 2));
    const res = await searchDmmActress(a.name);
    if (res.ok) {
      const exact = res.items.filter((p) => keys.has(normalizePersonName(p.name)) && p.imageUrl);
      if (exact.length === 1) {
        if (apply) {
          await db
            .update(actresses)
            .set({ imageUrl: exact[0].imageUrl, dmmActressId: exact[0].id, dmmCheckedAt: new Date(), updatedAt: new Date() })
            .where(eq(actresses.id, a.id));
        }
        done.add(a.id);
        byDmm++;
        if (byDmm % 50 === 0) console.log(`  DMMで ${byDmm}人`);
      }
    }
    await sleep(1100);
  }
}

// 3) 取り込み元ページの画像（最後の手段）
if (!skipSource) {
  const rest = rows.filter((a) => !done.has(a.id));
  console.log(`取り込み元の画像で補完中… 残り ${rest.length}人`);
  for (const a of rest) {
    const urls = await db.selectDistinct({ url: enrollments.sourceUrl }).from(enrollments).where(eq(enrollments.actressId, a.id));
    // コウデリは表に女優写真が無いので、写真のあるページだけを対象にする
    const photoPages = urls.map((u) => u.url.replace(/#.*$/, "")).filter((u) => /^https?:\/\//.test(u) && !/koukyuderi\.jp/.test(u));
    if (photoPages.length === 0) continue;
    let image = "";
    for (const url of photoPages) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "AVShukkinNaviBot/1.0" }, signal: AbortSignal.timeout(20000) });
        if (!res.ok) continue;
        const html = await res.text();
        image = ogImage(html, url) || imageByAlt(html, url, a.name);
        // avfuuzoku は女優写真が無いので、作品画像を最後の手段にする
        if (!image && /avfuuzoku\.com/.test(url)) image = firstDmmImage(html, url);
      } catch {
        // 次のURLへ
      }
      if (image) break;
      await sleep(800);
    }
    if (image) {
      if (apply) await db.update(actresses).set({ sourceImageUrl: image, updatedAt: new Date() }).where(eq(actresses.id, a.id));
      done.add(a.id);
      bySource++;
      if (bySource % 50 === 0) console.log(`  取り込み元で ${bySource}人`);
    }
    await sleep(600);
  }
}

const total = rows.length;
const remaining = total - done.size;
console.log({
  total,
  dugaIndex: byIndex,
  dugaApi: byApi,
  dmm: byDmm,
  sourceImage: bySource,
  covered: done.size,
  photoMissing: noPhoto,
  remaining,
  fails,
  apply,
});
if (apply && remaining > 0) {
  const left = await db
    .select({ id: actresses.id, name: actresses.name, kana: actresses.kana })
    .from(actresses)
    .where(inArray(actresses.id, rows.filter((a) => !done.has(a.id)).map((a) => a.id)))
    .limit(50);
  console.log("画像が無い例", left.map((x) => `${x.name}${x.kana ? `(${x.kana})` : ""}`));
}
process.exit(0);

