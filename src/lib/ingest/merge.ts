// 取り込み元から読んだ「風俗店の名前」と「AV女優名」を、既存の店舗・女優に寄せる（マージする）処理。
//  - 女優：表記ゆれ（全角/半角・空白・カタカナ/ひらがな）と別名（括弧内）で同じ人を探す。完全な重複は1人に統合する
//  - 店舗：電話番号 → 都道府県＋店名（表記ゆれをそろえたもの） → 全国で1つに定まる店名、の順で探す
//  - 迷うもの（同じ名前が複数・都道府県不明）は新しく作らず、未照合として報告する
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { actresses, enrollments, schedules, shops } from "@/db/schema";
import { normalizeGenre } from "./avzoku";
import { isPlausibleActressName, normalizePersonName, normalizePhone, normalizeShopName, splitPersonNames } from "./normalize";
import type { ScrapedEntry } from "./types";

const NOTE = "許可済みまとめサイトの掲載情報（自動取り込み）";

type ActressLite = { id: number; name: string; kana: string; aliases: string[]; imageUrl: string; sourceImageUrl: string };
type ShopLite = { id: number; name: string; prefCode: number; area: string; genre: string; phone: string; officialUrl: string };

type Index = {
  actresses: ActressLite[];
  shops: ShopLite[];
  actKeys: Map<string, number[]>;
  kanaKeys: Map<string, number[]>;
  shopKeys: Map<string, number[]>;
  shopNames: Map<string, number[]>;
  phoneKeys: Map<string, number>;
  counts: Map<number, number>;
  shopCounts: Map<number, number>;
};

const add = <T>(m: Map<string, T[]>, k: string, v: T) => {
  const list = m.get(k);
  if (list) {
    if (!list.includes(v)) list.push(v);
  } else m.set(k, [v]);
};

function indexActress(idx: Index, a: ActressLite) {
  for (const n of [a.name, ...a.aliases]) {
    const k = normalizePersonName(n);
    if (k.length >= 2) add(idx.actKeys, k, a.id);
  }
  const kana = normalizePersonName(a.kana);
  if (kana.length >= 2) add(idx.kanaKeys, kana, a.id);
}

function indexShop(idx: Index, s: ShopLite) {
  const key = normalizeShopName(s.name);
  if (key) {
    add(idx.shopKeys, `${s.prefCode}|${key}`, s.id);
    add(idx.shopNames, key, s.id);
  }
  const phone = normalizePhone(s.phone);
  if (phone) idx.phoneKeys.set(phone, s.id);
}

function rebuildActress(idx: Index) {
  idx.actKeys.clear();
  idx.kanaKeys.clear();
  for (const a of idx.actresses) indexActress(idx, a);
}
function rebuildShop(idx: Index) {
  idx.shopKeys.clear();
  idx.shopNames.clear();
  idx.phoneKeys.clear();
  for (const s of idx.shops) indexShop(idx, s);
}

let cached: Index | null = null;

/** 照合用の一覧を読み込む（1回の実行の中で使い回す） */
export async function loadMergeIndex(): Promise<Index> {
  if (cached) return cached;
  const [as, ss, cs, scs] = await Promise.all([
    db.select({ id: actresses.id, name: actresses.name, kana: actresses.kana, aliases: actresses.aliases, imageUrl: actresses.imageUrl, sourceImageUrl: actresses.sourceImageUrl }).from(actresses),
    db
      .select({ id: shops.id, name: shops.name, prefCode: shops.prefCode, area: shops.area, genre: shops.genre, phone: shops.phone, officialUrl: shops.officialUrl })
      .from(shops),
    db
      .select({ actressId: enrollments.actressId, n: sql<number>`count(*)::int` })
      .from(enrollments)
      .groupBy(enrollments.actressId),
    db
      .select({ shopId: enrollments.shopId, n: sql<number>`count(*)::int` })
      .from(enrollments)
      .groupBy(enrollments.shopId),
  ]);
  const idx: Index = {
    actresses: as,
    shops: ss,
    actKeys: new Map(),
    kanaKeys: new Map(),
    shopKeys: new Map(),
    shopNames: new Map(),
    phoneKeys: new Map(),
    counts: new Map(cs.map((c) => [c.actressId, c.n])),
    shopCounts: new Map(scs.map((c) => [c.shopId, c.n])),
  };
  for (const a of as) indexActress(idx, a);
  for (const s of ss) indexShop(idx, s);
  cached = idx;
  return idx;
}

export function clearMergeIndex() {
  cached = null;
}

const pickBest = (ids: number[], counts: Map<number, number>) =>
  [...ids].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a - b)[0];

/** 出勤を残したまま、重複した在籍を統合する */
async function moveSchedules(fromEnrollmentId: number, toEnrollmentId: number) {
  if (fromEnrollmentId === toEnrollmentId) return;
  await db.execute(sql`
    INSERT INTO schedules (enrollment_id, work_date, start_time, end_time, status, origin, updated_at)
    SELECT ${toEnrollmentId}, work_date, start_time, end_time, status, origin, updated_at
    FROM schedules WHERE enrollment_id = ${fromEnrollmentId}
    ON CONFLICT (enrollment_id, work_date) DO NOTHING
  `);
}

/** 重複した女優を1人に統合する（在籍・出勤を移してから、重複側を消す） */
export async function mergeActressInto(winnerId: number, loserId: number): Promise<boolean> {
  if (winnerId === loserId) return false;
  const [winner] = await db
    .select({
      id: actresses.id,
      name: actresses.name,
      kana: actresses.kana,
      aliases: actresses.aliases,
      imageUrl: actresses.imageUrl,
      sourceImageUrl: actresses.sourceImageUrl,
      isPublished: actresses.isPublished,
      optedOut: actresses.optedOut,
    })
    .from(actresses)
    .where(eq(actresses.id, winnerId));
  const [loser] = await db
    .select({
      id: actresses.id,
      name: actresses.name,
      kana: actresses.kana,
      aliases: actresses.aliases,
      imageUrl: actresses.imageUrl,
      sourceImageUrl: actresses.sourceImageUrl,
      isPublished: actresses.isPublished,
      optedOut: actresses.optedOut,
    })
    .from(actresses)
    .where(eq(actresses.id, loserId));
  if (!winner || !loser) return false;
  // よみがなが両方にあって違うなら、同名の別人かもしれないので統合しない
  if (winner.kana && loser.kana && normalizePersonName(winner.kana) !== normalizePersonName(loser.kana)) return false;

  const rows = await db.select({ id: enrollments.id, shopId: enrollments.shopId }).from(enrollments).where(eq(enrollments.actressId, loserId));
  for (const r of rows) {
    const [dup] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.actressId, winnerId), eq(enrollments.shopId, r.shopId)))
      .limit(1);
    if (dup) {
      await moveSchedules(r.id, dup.id);
      await db.delete(enrollments).where(eq(enrollments.id, r.id));
    } else {
      await db.update(enrollments).set({ actressId: winnerId, updatedAt: new Date() }).where(eq(enrollments.id, r.id));
    }
  }
  // 重複側の名前も別名として残す（あとから同じ表記で取り込んでも同じ人に寄る）
  const aliases = [...new Set([...winner.aliases, ...loser.aliases, loser.name])]
    .filter((a) => a && normalizePersonName(a) !== normalizePersonName(winner.name))
    .slice(0, 20);
  await db
    .update(actresses)
    .set({
      aliases,
      kana: winner.kana || loser.kana,
      imageUrl: winner.imageUrl || loser.imageUrl,
      sourceImageUrl: winner.sourceImageUrl || loser.sourceImageUrl,
      // 掲載停止・非公開の意思は統合後も残す
      isPublished: winner.isPublished && loser.isPublished,
      optedOut: winner.optedOut || loser.optedOut,
      updatedAt: new Date(),
    })
    .where(eq(actresses.id, winnerId));
  await db.delete(actresses).where(eq(actresses.id, loserId));
  return true;
}

/** 重複した店舗を1つに統合する */
export async function mergeShopInto(winnerId: number, loserId: number): Promise<boolean> {
  if (winnerId === loserId) return false;
  const [winner] = await db
    .select({ id: shops.id, area: shops.area, genre: shops.genre, phone: shops.phone, officialUrl: shops.officialUrl, isPublished: shops.isPublished })
    .from(shops)
    .where(eq(shops.id, winnerId));
  const [loser] = await db
    .select({ id: shops.id, area: shops.area, genre: shops.genre, phone: shops.phone, officialUrl: shops.officialUrl, isPublished: shops.isPublished })
    .from(shops)
    .where(eq(shops.id, loserId));
  if (!winner || !loser) return false;

  const rows = await db.select({ id: enrollments.id, actressId: enrollments.actressId }).from(enrollments).where(eq(enrollments.shopId, loserId));
  for (const r of rows) {
    const [dup] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.actressId, r.actressId), eq(enrollments.shopId, winnerId)))
      .limit(1);
    if (dup) {
      await moveSchedules(r.id, dup.id);
      await db.delete(enrollments).where(eq(enrollments.id, r.id));
    } else {
      await db.update(enrollments).set({ shopId: winnerId, updatedAt: new Date() }).where(eq(enrollments.id, r.id));
    }
  }
  // 空欄の項目だけ、重複側から引き継ぐ
  await db
    .update(shops)
    .set({
      area: winner.area || loser.area,
      genre: winner.genre && winner.genre !== "その他" ? winner.genre : loser.genre || winner.genre,
      phone: winner.phone || loser.phone,
      officialUrl: winner.officialUrl || loser.officialUrl,
      isPublished: winner.isPublished && loser.isPublished,
      updatedAt: new Date(),
    })
    .where(eq(shops.id, winnerId));
  await db.delete(shops).where(eq(shops.id, loserId));
  return true;
}

export type ResolvedActress = { id: number; created: boolean; merged: number; sourceImageUrl: string };

/** 女優名から既存の1人を探す（見つからなければ作る） */
async function resolveActress(entry: ScrapedEntry, idx: Index): Promise<ResolvedActress | null> {
  const parsed = splitPersonNames(entry.actressName);
  const names = [parsed.name, ...(entry.aliases ?? []), ...parsed.aliases].filter(Boolean);
  const keys = [...new Set(names.map(normalizePersonName).filter((k) => k.length >= 2))];

  let ids = [...new Set(keys.flatMap((k) => idx.actKeys.get(k) ?? []))];
  if (ids.length === 0 && entry.kana) {
    const kanaKey = normalizePersonName(entry.kana);
    if (kanaKey.length >= 2) ids = idx.kanaKeys.get(kanaKey) ?? [];
  }

  if (ids.length === 0) {
    if (!isPlausibleActressName(parsed.name)) return null;
    const [row] = await db
      .insert(actresses)
      .values({ name: parsed.name, kana: entry.kana ?? "", aliases: parsed.aliases })
      .returning({ id: actresses.id });
    const lite: ActressLite = {
      id: row.id,
      name: parsed.name,
      kana: entry.kana ?? "",
      aliases: parsed.aliases,
      imageUrl: "",
      sourceImageUrl: "",
    };
    idx.actresses.push(lite);
    indexActress(idx, lite);
    idx.counts.set(row.id, 0);
    return { id: row.id, created: true, merged: 0, sourceImageUrl: "" };
  }

  const winnerId = pickBest(ids, idx.counts);
  let merged = 0;
  for (const loserId of ids) {
    if (loserId === winnerId) continue;
    if (await mergeActressInto(winnerId, loserId)) {
      idx.actresses = idx.actresses.filter((a) => a.id !== loserId);
      idx.counts.delete(loserId);
      merged++;
    }
  }
  if (merged) {
    rebuildActress(idx);
    // 統合で変わった項目（よみがな・別名）を、以降の更新で上書きしないよう読み直す
    const [fresh] = await db
      .select({ kana: actresses.kana, aliases: actresses.aliases, sourceImageUrl: actresses.sourceImageUrl })
      .from(actresses)
      .where(eq(actresses.id, winnerId));
    const c = idx.actresses.find((a) => a.id === winnerId);
    if (fresh && c) {
      c.kana = fresh.kana;
      c.aliases = fresh.aliases;
      c.sourceImageUrl = fresh.sourceImageUrl;
    }
  }

  const cur = idx.actresses.find((a) => a.id === winnerId);
  if (cur) {
    const addAliases = names.filter((n) => {
      const k = normalizePersonName(n);
      return k.length >= 2 && k !== normalizePersonName(cur.name) && isPlausibleActressName(n) && !cur.aliases.includes(n);
    });
    const nextKana = cur.kana || entry.kana || "";
    if (addAliases.length || nextKana !== cur.kana) {
      if (addAliases.length) cur.aliases = [...new Set([...cur.aliases, ...addAliases])].slice(0, 20);
      cur.kana = nextKana;
      await db.update(actresses).set({ aliases: cur.aliases, kana: cur.kana, updatedAt: new Date() }).where(eq(actresses.id, winnerId));
      rebuildActress(idx);
    }
  }
  return { id: winnerId, created: false, merged, sourceImageUrl: cur?.sourceImageUrl ?? "" };
}

export type ResolvedShop = { id: number; created: boolean; merged: number };

/** 店名から既存の1店を探す（電話番号 → 都道府県＋店名 → 全国で1つに定まる店名） */
async function resolveShop(entry: ScrapedEntry, idx: Index): Promise<ResolvedShop | null> {
  const key = normalizeShopName(entry.shopName);
  if (!key) return null;
  const phone = normalizePhone(entry.phone);

  let ids: number[] = [];
  if (phone) {
    const id = idx.phoneKeys.get(phone);
    if (id) ids = [id];
  }
  if (ids.length === 0 && entry.prefCode) ids = idx.shopKeys.get(`${entry.prefCode}|${key}`) ?? [];
  if (ids.length === 0) {
    const all = idx.shopNames.get(key) ?? [];
    if (all.length === 1) ids = all;
  }

  if (ids.length === 0) {
    if (!entry.prefCode) return null;
    const genre = normalizeGenre(entry.genre ?? "") || (/チャイデリ|チャイナデリ|チャイニーズデリ/.test(entry.shopName) ? "チャイデリ" : "");
    const [row] = await db
      .insert(shops)
      .values({ name: entry.shopName, prefCode: entry.prefCode, area: entry.area ?? "", genre, officialUrl: entry.shopUrl ?? "", phone })
      .returning({ id: shops.id });
    const lite: ShopLite = {
      id: row.id,
      name: entry.shopName,
      prefCode: entry.prefCode,
      area: entry.area ?? "",
      genre,
      phone,
      officialUrl: entry.shopUrl ?? "",
    };
    idx.shops.push(lite);
    indexShop(idx, lite);
    return { id: row.id, created: true, merged: 0 };
  }

  const winnerId = pickBest(ids, idx.shopCounts);
  let merged = 0;
  for (const loserId of ids) {
    if (loserId === winnerId) continue;
    if (await mergeShopInto(winnerId, loserId)) {
      idx.shops = idx.shops.filter((s) => s.id !== loserId);
      idx.shopCounts.delete(loserId);
      merged++;
    }
  }
  if (merged) {
    rebuildShop(idx);
    // 統合で変わった項目（地域・業種・電話）を、以降の更新で上書きしないよう読み直す
    const [fresh] = await db
      .select({ area: shops.area, genre: shops.genre, phone: shops.phone, officialUrl: shops.officialUrl })
      .from(shops)
      .where(eq(shops.id, winnerId));
    const c = idx.shops.find((s) => s.id === winnerId);
    if (fresh && c) Object.assign(c, fresh);
  }

  const cur = idx.shops.find((s) => s.id === winnerId);
  if (cur) {
    const entryGenre = normalizeGenre(entry.genre ?? "") || (/チャイデリ|チャイナデリ|チャイニーズデリ/.test(entry.shopName) ? "チャイデリ" : "");
    const next = {
      area: cur.area || entry.area || "",
      genre: cur.genre && cur.genre !== "その他" ? cur.genre : entryGenre || cur.genre,
      phone: cur.phone || phone,
      officialUrl: cur.officialUrl || entry.shopUrl || "",
    };
    if (next.area !== cur.area || next.genre !== cur.genre || next.phone !== cur.phone || next.officialUrl !== cur.officialUrl) {
      Object.assign(cur, next);
      await db
        .update(shops)
        .set({ area: cur.area, genre: cur.genre, phone: cur.phone, officialUrl: cur.officialUrl, updatedAt: new Date() })
        .where(eq(shops.id, winnerId));
      indexShop(idx, cur);
    }
  }
  return { id: winnerId, created: false, merged };
}

export type ApplyEntriesResult = { applied: number; createdActresses: number; createdShops: number; merged: number; unmatched: string[] };

/**
 * 1ページ分の在籍を反映する。
 * prune を渡したときは、そのページを根拠にした在籍のうち、今回載っていなかった店を「退店」にする
 * （1ページにその女優の全店舗が載る取り込み元だけで使う）。
 */
export async function applyScrapedEntries(
  entries: ScrapedEntry[],
  opts: { today: string; prune?: { actressName: string; aliases?: string[]; sourceUrl: string }; sourceImageUrl?: string },
): Promise<ApplyEntriesResult> {
  const idx = await loadMergeIndex();
  const res: ApplyEntriesResult = { applied: 0, createdActresses: 0, createdShops: 0, merged: 0, unmatched: [] };
  let pruneActressId: number | null = null;
  let unresolvedShop = false;
  const keptShops = new Set<number>();

  if (opts.prune) {
    const parsed = splitPersonNames(opts.prune.actressName);
    const keys = [parsed.name, ...(opts.prune.aliases ?? []), ...parsed.aliases].map(normalizePersonName).filter((k) => k.length >= 2);
    const ids = [...new Set(keys.flatMap((k) => idx.actKeys.get(k) ?? []))];
    if (ids.length) pruneActressId = pickBest(ids, idx.counts);
  }

  for (const e of entries) {
    const a = await resolveActress(e, idx);
    if (!a) {
      if (res.unmatched.length < 50) res.unmatched.push(`${e.actressName}（源氏名 ${e.displayName}）`);
      continue;
    }
    if (a.created) res.createdActresses++;
    res.merged += a.merged;
    // DUGA/DMMに写真が無い女優のために、取り込み元ページの画像URLを残す（表示の最後の手段）
    if (opts.sourceImageUrl && a.sourceImageUrl !== opts.sourceImageUrl) {
      await db.update(actresses).set({ sourceImageUrl: opts.sourceImageUrl, updatedAt: new Date() }).where(eq(actresses.id, a.id));
      a.sourceImageUrl = opts.sourceImageUrl;
      const lite = idx.actresses.find((x) => x.id === a.id);
      if (lite) lite.sourceImageUrl = opts.sourceImageUrl;
    }

    const s = await resolveShop(e, idx);
    if (!s) {
      // 退店の注記だけ店名が合わない場合は、在籍の取り下げ（prune）を止めない
      if (e.status === "active") unresolvedShop = true;
      if (res.unmatched.length < 50) res.unmatched.push(`店名不明：${e.shopName}${e.area ? `（${e.area}）` : ""}`);
      continue;
    }
    if (s.created) res.createdShops++;
    res.merged += s.merged;

    const [enr] = await db
      .insert(enrollments)
      .values({
        actressId: a.id,
        shopId: s.id,
        shopDisplayName: e.displayName,
        sourceUrl: e.sourceUrl,
        sourceNote: NOTE,
        verifiedAt: e.verifiedAt ?? opts.today,
        status: e.status,
      })
      .onConflictDoUpdate({
        target: [enrollments.actressId, enrollments.shopId],
        set: {
          shopDisplayName: e.displayName,
          sourceUrl: e.sourceUrl,
          // 手で入れたメモは消さない
          sourceNote: sql`case when ${enrollments.sourceNote} = '' then excluded.source_note else ${enrollments.sourceNote} end`,
          verifiedAt: sql`greatest(${enrollments.verifiedAt}, excluded.verified_at)`,
          // 同じ根拠ページで「退店」→「在籍」に戻ったときだけ状態を変える（手で退店にしたものは戻さない）
          status: sql`case when ${enrollments.sourceUrl} = ${e.sourceUrl} then ${e.status}::text::enrollment_status else ${enrollments.status} end`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: enrollments.id });
    res.applied++;
    if (pruneActressId === null) pruneActressId = a.id;
    if (a.id === pruneActressId) keptShops.add(s.id);

    for (const sc of e.schedules ?? []) {
      if (sc.date < opts.today) continue;
      if (!sc.start || !sc.end) {
        await db
          .delete(schedules)
          .where(and(eq(schedules.enrollmentId, enr.id), eq(schedules.workDate, sc.date), eq(schedules.origin, "ingest")));
        continue;
      }
      await db
        .insert(schedules)
        .values({ enrollmentId: enr.id, workDate: sc.date, status: "working", startTime: sc.start, endTime: sc.end, origin: "ingest" })
        .onConflictDoUpdate({
          target: [schedules.enrollmentId, schedules.workDate],
          set: { status: "working", startTime: sc.start, endTime: sc.end, origin: "ingest", updatedAt: new Date() },
          setWhere: eq(schedules.origin, "ingest"),
        });
    }
  }

  if (opts.prune && !unresolvedShop) {
    // ページに1店も載っていない場合も含め、そのページを根拠にした在籍を退店にする
    if (pruneActressId) {
      const keep = [...keptShops];
      const cond = and(
        eq(enrollments.actressId, pruneActressId),
        eq(enrollments.sourceUrl, opts.prune.sourceUrl),
        eq(enrollments.status, "active"),
        keep.length ? sql`${enrollments.shopId} not in (${sql.join(keep.map((id) => sql`${id}`), sql`, `)})` : sql`true`,
      );
      await db.update(enrollments).set({ status: "left", updatedAt: new Date() }).where(cond);
    }
  }

  return res;
}

