// シティヘブンの「セクシー女優」一覧から、その日の出勤を取り込む
//  名前が1人に定まったもの → 在籍・出勤へ反映
//  定まらなかったもの      → 運営者が確認する一覧へ（公開画面には出さない）
import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { actresses, candidateGirls, enrollments, schedules, shops, type DataSource } from "@/db/schema";
import { todayJst } from "../dates";
import { ALL_PREF_CODES, listUrl, parseCityheavenList, prefSlugOf, type CityheavenGirl } from "./cityheaven";
import { matchActressName, type MatchCandidate } from "./name-match";
import { normalizePersonName } from "./normalize";
import { USER_AGENT, checkRobots } from "./robots";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 1ページごとの待ち時間（相手のサーバーに負担をかけないため） */
const POLITE_DELAY_MS = 1500;

export type CityheavenResult = {
  fetchedGirls: number;
  workingGirls: number;
  applied: number;
  createdShops: number;
  newCandidates: number;
  pendingTotal: number;
  errors: string[];
};

async function getHtml(url: string): Promise<string> {
  const robots = await checkRobots(url);
  if (!robots.allowed) throw new Error(`${robots.reason}（${url}）`);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store", signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`取得に失敗しました（HTTP ${res.status}：${url}）`);
  return res.text();
}

/** 取り込み元のURLから対象の都道府県を決める（未指定なら全国） */
export function targetPrefCodes(source: Pick<DataSource, "url">): number[] {
  const m = source.url.match(/cityheaven\.net\/([a-z]+)\//);
  if (!m) return ALL_PREF_CODES;
  const code = ALL_PREF_CODES.find((c) => prefSlugOf(c) === m[1]);
  return code ? [code] : ALL_PREF_CODES;
}

/** 掲載中の女優を照合の候補として読み出す（掲載停止の方は候補に入れない） */
async function loadCandidates(): Promise<MatchCandidate[]> {
  const rows = await db
    .select({ actressId: actresses.id, name: actresses.name, kana: actresses.kana, aliases: actresses.aliases })
    .from(actresses)
    .where(and(eq(actresses.isPublished, true), eq(actresses.optedOut, false)));
  return rows;
}

type DisplayNameIndex = {
  /** 店舗ID + 源氏名 → 女優ID（同じ店で同じ源氏名なら同一人物とみなす） */
  byShop: Map<string, number[]>;
  /** 源氏名 → 女優ID（全国で1人に定まる場合だけ使う） */
  global: Map<string, number[]>;
};

/**
 * 他の取り込み元（avfuzoku・FuuAV・コウデリ等）が持つ「店での源氏名 → AV女優」の対応を索引にする。
 * シティヘブンの源氏名はAV女優名と違うことが多いため、この逆引きを先に試す。
 */
async function loadDisplayNameIndex(): Promise<DisplayNameIndex> {
  const rows = await db
    .select({ shopId: enrollments.shopId, actressId: enrollments.actressId, name: enrollments.shopDisplayName })
    .from(enrollments)
    .where(eq(enrollments.status, "active"));
  const byShop = new Map<string, number[]>();
  const global = new Map<string, number[]>();
  const add = (m: Map<string, number[]>, key: string, id: number) => {
    const list = m.get(key);
    if (list) {
      if (!list.includes(id)) list.push(id);
    } else m.set(key, [id]);
  };
  for (const r of rows) {
    const key = normalizePersonName(r.name);
    if (key.length < 2) continue;
    add(byShop, `${r.shopId}|${key}`, r.actressId);
    add(global, key, r.actressId);
  }
  return { byShop, global };
}


/** 店舗を用意する（同じ名前・同じ都道府県があれば使い回す） */
async function ensureShop(g: CityheavenGirl): Promise<{ id: number; created: boolean }> {
  const [found] = await db.select({ id: shops.id }).from(shops).where(and(eq(shops.name, g.shopName), eq(shops.prefCode, g.prefCode))).limit(1);
  if (found) return { id: found.id, created: false };
  const [row] = await db
    .insert(shops)
    .values({ name: g.shopName, prefCode: g.prefCode, area: g.area, genre: g.genre, officialUrl: g.shopUrl })
    .returning({ id: shops.id });
  return { id: row.id, created: true };
}

/** 1人分を、在籍と当日の出勤へ反映する */
async function applyGirl(g: CityheavenGirl, actressId: number, today: string): Promise<boolean> {
  const shop = await ensureShop(g);
  const [enr] = await db
    .insert(enrollments)
    .values({
      actressId,
      shopId: shop.id,
      shopDisplayName: g.displayName,
      sourceUrl: g.girlUrl,
      sourceNote: "シティヘブン「セクシー女優」掲載（自動取り込み）",
      verifiedAt: today,
    })
    .onConflictDoUpdate({
      target: [enrollments.actressId, enrollments.shopId],
      // 運営者が手で「退店」にしたものは戻さない
      set: { shopDisplayName: g.displayName, sourceUrl: g.girlUrl, verifiedAt: today, updatedAt: new Date() },
    })
    .returning({ id: enrollments.id, status: enrollments.status });
  if (enr.status !== "active") return false;

  // DUGA/DMMに写真が無い女優のために、シティヘブンの女の子写真を表示用に残す
  if (g.imageUrl) {
    const [act] = await db.select({ sourceImageUrl: actresses.sourceImageUrl }).from(actresses).where(eq(actresses.id, actressId)).limit(1);
    if (act && !act.sourceImageUrl) {
      await db.update(actresses).set({ sourceImageUrl: g.imageUrl, updatedAt: new Date() }).where(eq(actresses.id, actressId));
    }
  }

  await db
    .insert(schedules)
    .values({ enrollmentId: enr.id, workDate: today, status: "working", origin: "ingest" })
    .onConflictDoUpdate({
      target: [schedules.enrollmentId, schedules.workDate],
      set: { status: "working", origin: "ingest", updatedAt: new Date() },
      // 運営者・お店が手で入れた予定は上書きしない
      setWhere: eq(schedules.origin, "ingest"),
    });
  return true;
}

/** 照合できなかった女の子を、確認待ちとして記録する（すでにあれば最終確認日だけ更新） */
async function upsertCandidate(g: CityheavenGirl): Promise<boolean> {
  const rows = await db
    .insert(candidateGirls)
    .values({
      externalId: g.girlId,
      source: "cityheaven",
      displayName: g.displayName,
      girlUrl: g.girlUrl,
      shopName: g.shopName,
      shopUrl: g.shopUrl,
      prefCode: g.prefCode,
      area: g.area,
      genre: g.genre,
    })
    .onConflictDoUpdate({
      target: [candidateGirls.source, candidateGirls.externalId],
      set: { displayName: g.displayName, shopName: g.shopName, lastSeenAt: new Date() },
    })
    .returning({ firstSeenAt: candidateGirls.firstSeenAt, lastSeenAt: candidateGirls.lastSeenAt });
  const r = rows[0];
  return Boolean(r) && r.firstSeenAt.getTime() === r.lastSeenAt.getTime();
}

export async function runCityheaven(source: DataSource): Promise<CityheavenResult> {
  const today = todayJst();
  const result: CityheavenResult = {
    fetchedGirls: 0,
    workingGirls: 0,
    applied: 0,
    createdShops: 0,
    newCandidates: 0,
    pendingTotal: 0,
    errors: [],
  };
  const candidates = await loadCandidates();
  // 他の取り込み元の「源氏名 → AV女優」対応（逆引き）
  const displayNames = await loadDisplayNameIndex();
  // すでに運営者が「対象外」と判断した女の子は、毎回並べ直さない
  const ignored = new Set(
    (await db.select({ id: candidateGirls.externalId }).from(candidateGirls).where(eq(candidateGirls.status, "ignored"))).map((r) => r.id),
  );
  // 運営者が結び付け済みの女の子は、その女優として反映する
  const linked = new Map(
    (
      await db
        .select({ id: candidateGirls.externalId, actressId: candidateGirls.linkedActressId })
        .from(candidateGirls)
        .where(eq(candidateGirls.status, "linked"))
    )
      .filter((r) => r.actressId != null)
      .map((r) => [r.id, r.actressId as number]),
  );

  const maxPages = Math.max(1, Math.min(20, source.maxPages));
  for (const prefCode of targetPrefCodes(source)) {
    for (let page = 1; page <= maxPages; page++) {
      const url = listUrl(prefCode, page);
      if (!url) break;
      let parsed;
      try {
        parsed = parseCityheavenList(await getHtml(url), prefCode);
      } catch (e) {
        result.errors.push(e instanceof Error ? e.message : String(e));
        if (result.errors.length >= 10) return result;
        break;
      }
      result.fetchedGirls += parsed.girls.length;

      for (const g of parsed.girls.filter((x) => x.workingToday)) {
        result.workingGirls++;
        if (ignored.has(g.girlId)) continue;
        try {
          const shopBefore = await ensureShop(g);
          if (shopBefore.created) result.createdShops++;

          // 1) 運営者が結び付けた女の子 → 2) AV女優名・別名 → 3) 他の店データの源氏名から逆引き
          let actressId = linked.get(g.girlId) ?? null;
          if (!actressId) {
            const m = matchActressName(g.displayName, candidates);
            if (m.kind === "matched") actressId = m.actressId;
          }
          if (!actressId) {
            const key = normalizePersonName(g.displayName);
            const byShop = displayNames.byShop.get(`${shopBefore.id}|${key}`) ?? [];
            const ids = byShop.length ? byShop : displayNames.global.get(key) ?? [];
            if (ids.length === 1) actressId = ids[0];
          }

          if (actressId) {
            if (await applyGirl(g, actressId, today)) result.applied++;
          } else if (await upsertCandidate(g)) {
            result.newCandidates++;
          }
        } catch (e) {
          result.errors.push(`${g.displayName}（${g.shopName}）: ${e instanceof Error ? e.message : String(e)}`);
          if (result.errors.length >= 10) return result;
        }
      }

      await sleep(POLITE_DELAY_MS);
      if (!parsed.hasNextPage) break;
    }
  }

  const [p] = await db.select({ n: sql<number>`count(*)::int` }).from(candidateGirls).where(eq(candidateGirls.status, "pending"));
  result.pendingTotal = p?.n ?? 0;
  return result;
}

/** 確認待ちの女の子を、指定した女優として結び付ける（運営者の操作から呼ぶ） */
export async function linkCandidate(candidateId: number, actressId: number, userId: number): Promise<void> {
  const [c] = await db.select().from(candidateGirls).where(eq(candidateGirls.id, candidateId)).limit(1);
  if (!c) throw new Error("確認待ちの女の子が見つかりません");
  const shop = await ensureShop({
    girlId: c.externalId,
    displayName: c.displayName,
    girlUrl: c.girlUrl,
    imageUrl: "",
    shopName: c.shopName,
    shopUrl: c.shopUrl,
    genre: c.genre,
    area: c.area,
    prefCode: c.prefCode,
    workingToday: true,
    age: null,
  });
  await db
    .insert(enrollments)
    .values({
      actressId,
      shopId: shop.id,
      shopDisplayName: c.displayName,
      sourceUrl: c.girlUrl,
      sourceNote: "運営者が掲載ページを確認して結び付け",
      verifiedAt: todayJst(),
    })
    .onConflictDoUpdate({
      target: [enrollments.actressId, enrollments.shopId],
      set: { shopDisplayName: c.displayName, sourceUrl: c.girlUrl, verifiedAt: todayJst(), status: "active", updatedAt: new Date() },
    });
  await db
    .update(candidateGirls)
    .set({ status: "linked", linkedActressId: actressId, decidedBy: userId, decidedAt: new Date() })
    .where(eq(candidateGirls.id, candidateId));
}

/** まとめて対象外にする */
export async function ignoreCandidates(ids: number[], userId: number): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(candidateGirls)
    .set({ status: "ignored", decidedBy: userId, decidedAt: new Date() })
    .where(inArray(candidateGirls.id, ids));
}
