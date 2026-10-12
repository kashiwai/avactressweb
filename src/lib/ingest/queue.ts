// まとめサイト型の取り込みを「待ち行列」で少しずつ処理する。
// 1回の実行時間（Vercel の上限 300 秒）に収まるよう締め切りを決め、残りは次の実行で続きから処理する。
//   1) 一覧ページから女優ページのURLを集めて待ち行列へ入れる（取り込み元ごとに1日1回）
//   2) 待ち行列の女優ページを1秒間隔で読み、在籍・出勤へ反映する（締め切りまで）
import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { actresses, dataSources, enrollments, ingestQueue, ingestRuns, shops, type DataSource } from "@/db/schema";
import { addDays, todayJst } from "../dates";
import { applyAggregatedActress } from "./aggregator";
import { parseAvzokuActress, parseAvzokuList } from "./avzoku";
import { parseAvfuzokuActress, parseAvfuzokuIndex } from "./avfuzoku";
import { USER_AGENT, checkRobots } from "./robots";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_ATTEMPTS = 3;

/** 待ち行列で処理する取り込み元の種類 */
export const QUEUED_KINDS = ["avzoku", "avfuzoku"] as const;
type QueuedKind = (typeof QUEUED_KINDS)[number];
export const isQueuedKind = (k: string): k is QueuedKind => (QUEUED_KINDS as readonly string[]).includes(k);

/** 一覧を読み直す間隔（日）。出勤情報は毎日、在籍情報だけのサイトは3日ごと（相手のサイトへの負担を抑える） */
const INTERVAL_DAYS: Record<QueuedKind, number> = { avzoku: 1, avfuzoku: 3 };

async function getHtml(url: string): Promise<string> {
  const robots = await checkRobots(url);
  if (!robots.allowed) throw new Error(`${robots.reason}（${url}）`);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`取得に失敗しました（HTTP ${res.status}：${url}）`);
  return res.text();
}

/** 日本時間の今日0時（UTC の Date） */
function jstMidnight(day: string): Date {
  return new Date(`${day}T00:00:00+09:00`);
}

/** 一覧ページを読んで、女優ページを待ち行列へ入れる。force のときは今日処理済みのものも入れ直す */
export async function enqueueSource(source: DataSource, opts: { force?: boolean; deadline?: number } = {}): Promise<{ runId: number; queued: number; error?: string }> {
  const today = todayJst();
  const [run] = await db.insert(ingestRuns).values({ sourceId: source.id }).returning({ id: ingestRuns.id });
  try {
    const urls = new Set<string>();
    if (source.kind === "avfuzoku") {
      parseAvfuzokuIndex(await getHtml(source.url)).forEach((u) => urls.add(u));
    } else {
      let url: string | null = source.url;
      for (let page = 0; url && page < Math.max(1, source.maxPages); page++) {
        if (opts.deadline && Date.now() > opts.deadline) break;
        const list = parseAvzokuList(await getHtml(url));
        list.actressUrls.forEach((u) => urls.add(u));
        url = list.nextUrl;
        await sleep(1000);
      }
    }
    if (urls.size === 0) throw new Error("一覧ページから女優を1人も読み取れませんでした。ページの作りが変わった可能性があります");

    const rows = [...urls].map((u) => ({ sourceId: source.id, runId: run.id, runDate: today, url: u }));
    if (opts.force) {
      await db
        .insert(ingestQueue)
        .values(rows)
        .onConflictDoUpdate({
          target: [ingestQueue.sourceId, ingestQueue.runDate, ingestQueue.url],
          set: { status: "pending", attempts: 0, lastError: null, runId: run.id, updatedAt: new Date() },
        });
    } else {
      await db.insert(ingestQueue).values(rows).onConflictDoNothing();
    }
    await db.update(ingestRuns).set({ fetchedCount: urls.size }).where(eq(ingestRuns.id, run.id));
    await db
      .update(dataSources)
      .set({ lastRunAt: new Date(), lastStatus: `処理中：${urls.size}人分を順に取り込んでいます` })
      .where(eq(dataSources.id, source.id));
    return { runId: run.id, queued: urls.size };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ingest] enqueue source=${source.id} failed: ${msg}`);
    await db.update(ingestRuns).set({ finishedAt: new Date(), ok: false, error: msg }).where(eq(ingestRuns.id, run.id));
    await db.update(dataSources).set({ lastRunAt: new Date(), lastStatus: `失敗：${msg}` }).where(eq(dataSources.id, source.id));
    return { runId: run.id, queued: 0, error: msg };
  }
}

/** 今日まだ一覧を読んでいない取り込み元を待ち行列へ入れる */
export async function enqueueDueSources(deadline: number): Promise<number> {
  const today = todayJst();
  const sources = await db
    .select()
    .from(dataSources)
    .where(and(eq(dataSources.enabled, true), eq(dataSources.termsConfirmed, true)))
    .orderBy(asc(dataSources.id));
  let n = 0;
  for (const s of sources) {
    if (!isQueuedKind(s.kind)) continue;
    if (Date.now() > deadline) break;
    const since = jstMidnight(addDays(today, -(INTERVAL_DAYS[s.kind] - 1)));
    const [already] = await db
      .select({ id: ingestRuns.id })
      .from(ingestRuns)
      .where(and(eq(ingestRuns.sourceId, s.id), gte(ingestRuns.startedAt, since)))
      .limit(1);
    if (already) continue;
    await enqueueSource(s, { deadline });
    n++;
  }
  return n;
}

/** 待ち行列を締め切りまで処理する */
export async function drainQueue(deadline: number): Promise<{ processed: number; applied: number; errors: number; remaining: number }> {
  const today = todayJst();
  let processed = 0, applied = 0, errors = 0;
  while (Date.now() < deadline) {
    const batch = await db
      .select({ item: ingestQueue, kind: dataSources.kind })
      .from(ingestQueue)
      .innerJoin(dataSources, eq(dataSources.id, ingestQueue.sourceId))
      .where(and(eq(ingestQueue.status, "pending"), gte(ingestQueue.runDate, addDays(today, -3))))
      .orderBy(asc(ingestQueue.id))
      .limit(10);
    if (batch.length === 0) break;
    for (const { item, kind } of batch) {
      if (Date.now() > deadline) break;
      try {
        let r = { applied: 0, createdActress: false, createdShop: false };
        let note: string | null = null;
        if (kind === "avfuzoku") {
          const x = await applyAvfuzokuPage(await getHtml(item.url), item.url, today);
          r = x.result;
          note = x.note;
        } else {
          const a = parseAvzokuActress(await getHtml(item.url), item.url, today);
          if (!a) note = `読み取れませんでした：${item.url}`;
          else if (!a.prefCode) note = `${a.name}（都道府県不明）`;
          else r = await applyAggregatedActress(a, today);
        }

        await db.update(ingestQueue).set({ status: "done", attempts: item.attempts + 1, lastError: note, updatedAt: new Date() }).where(eq(ingestQueue.id, item.id));
        if (item.runId) {
          await db
            .update(ingestRuns)
            .set({
              appliedCount: sql`${ingestRuns.appliedCount} + ${r.applied}`,
              createdActresses: sql`${ingestRuns.createdActresses} + ${r.createdActress ? 1 : 0}`,
              createdShops: sql`${ingestRuns.createdShops} + ${r.createdShop ? 1 : 0}`,
              ...(note ? { unmatchedNames: sql`${ingestRuns.unmatchedNames} || ${JSON.stringify([note])}::jsonb` } : {}),
            })
            .where(eq(ingestRuns.id, item.runId));
        }
        applied += r.applied;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const attempts = item.attempts + 1;
        await db
          .update(ingestQueue)
          .set({ status: attempts >= MAX_ATTEMPTS ? "error" : "pending", attempts, lastError: msg, updatedAt: new Date() })
          .where(eq(ingestQueue.id, item.id));
        errors++;
      }
      processed++;
      await sleep(1000);
    }
  }
  await closeFinishedRuns();
  const [rest] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ingestQueue)
    .where(and(eq(ingestQueue.status, "pending"), gte(ingestQueue.runDate, addDays(today, -3))));
  return { processed, applied, errors, remaining: rest?.n ?? 0 };
}

/** 待ち行列を処理し終えた実行を「完了」にして、取り込み元の状態を更新する */
async function closeFinishedRuns(): Promise<void> {
  const open = await db.select().from(ingestRuns).where(isNull(ingestRuns.finishedAt));
  for (const run of open) {
    const [c] = await db
      .select({
        pending: sql<number>`count(*) filter (where ${ingestQueue.status} = 'pending')::int`,
        failed: sql<number>`count(*) filter (where ${ingestQueue.status} = 'error')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(ingestQueue)
      .where(eq(ingestQueue.runId, run.id));
    if (!c || c.total === 0 || c.pending > 0) continue;
    const ok = c.failed === 0;
    await db
      .update(ingestRuns)
      .set({ finishedAt: new Date(), ok, error: ok ? null : `${c.failed}人分のページを読めませんでした` })
      .where(eq(ingestRuns.id, run.id));
    await db
      .update(dataSources)
      .set({ lastRunAt: new Date(), lastStatus: ok ? `成功：${run.appliedCount}件反映` : `一部失敗：${run.appliedCount}件反映・${c.failed}人分を読めず` })
      .where(eq(dataSources.id, run.sourceId));
  }
}

/** 古い待ち行列を片付ける（7日より前） */
export async function pruneQueue(): Promise<void> {
  await db.delete(ingestQueue).where(lt(ingestQueue.runDate, addDays(todayJst(), -7)));
}

/** 店名だけで都道府県が1つに決まる既存店舗があれば、その都道府県を使う */
async function prefOfKnownShop(shopName: string): Promise<number | null> {
  const rows = await db.selectDistinct({ pref: shops.prefCode }).from(shops).where(eq(shops.name, shopName)).limit(2);
  return rows.length === 1 ? rows[0].pref : null;
}

/**
 * avfuzoku の女優ページ1件を在籍へ反映する（出勤は扱わない）。
 * ページに載っている店は在籍中に、「退店しました」と書かれた店・ページから消えた店は退店にする。
 */
async function applyAvfuzokuPage(html: string, url: string, today: string): Promise<{ result: { applied: number; createdActress: boolean; createdShop: boolean }; note: string | null }> {
  const a = parseAvfuzokuActress(html, url);
  const result = { applied: 0, createdActress: false, createdShop: false };
  if (!a) return { result, note: `読み取れませんでした：${url}` };
  const unknown: string[] = [];
  const keptShopIds: number[] = [];
  for (const e of a.entries) {
    const prefCode = e.prefCode ?? (await prefOfKnownShop(e.shopName));
    if (!prefCode) {
      unknown.push(`${e.shopName}(${e.area})`);
      continue;
    }
    const r = await applyAggregatedActress(
      { url, name: a.name, kana: a.kana, prefCode, area: e.area, genre: e.genre, shopName: e.shopName, shopUrl: e.shopUrl, displayName: e.displayName || a.name, verifiedAt: today, schedules: [] },
      today,
    );
    if (r.createdActress) result.createdActress = true;
    if (r.createdShop) result.createdShop = true;
    result.applied++;
    const [shop] = await db.select({ id: shops.id }).from(shops).where(and(eq(shops.name, e.shopName), eq(shops.prefCode, prefCode))).limit(1);
    if (shop) keptShopIds.push(shop.id);
  }
  // このページを根拠に作った在籍のうち、今回載っていなかった店は退店にする
  const [act] = await db.select({ id: actresses.id }).from(actresses).where(eq(actresses.name, a.name)).limit(1);
  if (act) {
    await db
      .update(enrollments)
      .set({ status: "left", updatedAt: new Date() })
      .where(
        and(
          eq(enrollments.actressId, act.id),
          eq(enrollments.sourceUrl, url),
          eq(enrollments.status, "active"),
          keptShopIds.length ? notInArray(enrollments.shopId, keptShopIds) : sql`true`,
        ),
      );
    if (a.leftShops.length) {
      const leftIds = (await db.select({ id: shops.id }).from(shops).where(inArray(shops.name, a.leftShops))).map((x) => x.id);
      if (leftIds.length) {
        await db
          .update(enrollments)
          .set({ status: "left", updatedAt: new Date() })
          .where(and(eq(enrollments.actressId, act.id), inArray(enrollments.shopId, leftIds), eq(enrollments.sourceUrl, url)));
      }
    }
  }
  return { result, note: unknown.length ? `${a.name}：都道府県不明の店 ${unknown.join("、")}` : null };
}
