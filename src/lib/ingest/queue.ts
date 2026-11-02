// まとめサイト型の取り込みを「待ち行列」で少しずつ処理する。
// 1回の実行時間（Vercel の上限 300 秒）に収まるよう締め切りを決め、残りは次の実行で続きから処理する。
//   1) 一覧ページから女優・店舗ページのURLを集めて待ち行列へ入れる（取り込み元ごとに1〜3日に1回）
//   2) 待ち行列のページを1秒間隔で読み、在籍・出勤へ反映する（締め切りまで）
import "server-only";
import { and, asc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { dataSources, ingestQueue, ingestRuns, jobLeases, type DataSource } from "@/db/schema";
import { addDays, todayJst } from "../dates";
import { applyQueuedUrl, collectSourceUrls, INTERVAL_DAYS, isQueuedKind, type QueuedKind } from "./sources";
import { USER_AGENT, checkRobots } from "./robots";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const MAX_ATTEMPTS = 3;

export { QUEUED_KINDS, isQueuedKind } from "./sources";

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
    if (!isQueuedKind(source.kind)) throw new Error(`この形式は待ち行列の対象ではありません（${source.kind}）`);
    const list = await collectSourceUrls(source.kind, source.url, {
      getHtml,
      sleep,
      maxPages: Math.max(1, source.maxPages),
      deadline: opts.deadline,
    });
    if (list.length === 0) throw new Error("一覧ページから女優を1人も読み取れませんでした。ページの作りが変わった可能性があります");

    const urls = new Set(list);
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

/**
 * 実行時間の上限で強制終了され、終了の記録も待ち行列も残っていない実行を「時間切れ」として片付ける。
 * これをしないと「今日は実行済み」と見なされ、その日の取り込みがやり直されない。
 */
export async function closeAbandonedRuns(): Promise<number> {
  const stale = new Date(Date.now() - 10 * 60_000);
  const rows = await db
    .update(ingestRuns)
    .set({ finishedAt: new Date(), ok: false, error: "実行時間の上限で途中終了しました（次の実行でやり直します）" })
    .where(
      and(
        isNull(ingestRuns.finishedAt),
        lt(ingestRuns.startedAt, stale),
        sql`not exists (select 1 from ${ingestQueue} q where q.run_id = ${ingestRuns.id})`,
      ),
    )
    .returning({ id: ingestRuns.id });
  return rows.length;
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
    // 前回の待ち行列が残っている間は、同じページを二重に入れない（片付いてから次の一覧を読む）
    const [pending] = await db
      .select({ id: ingestQueue.id })
      .from(ingestQueue)
      .where(and(eq(ingestQueue.sourceId, s.id), eq(ingestQueue.status, "pending"), gte(ingestQueue.runDate, addDays(today, -3))))
      .limit(1);
    if (pending) continue;
    const since = jstMidnight(addDays(today, -(INTERVAL_DAYS[s.kind] - 1)));
    const [already] = await db
      .select({ id: ingestRuns.id })
      .from(ingestRuns)
      .where(
        and(
          eq(ingestRuns.sourceId, s.id),
          gte(ingestRuns.startedAt, since),
          // 時間切れで途中終了した実行は「実行済み」に数えない
          sql`coalesce(${ingestRuns.error}, '') not like '実行時間の上限%'`,
        ),
      )
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
        const x = await applyQueuedUrl(kind as QueuedKind, item.url, getHtml, today);
        const r = { applied: x.applied, createdActress: x.createdActress, createdShop: x.createdShop };
        const note = x.note;

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

/**
 * 実行中の札を取る。取れたときだけ true（ほかの実行が札を持っていれば false）。
 * 札には有効期限を付け、途中で強制終了されても期限が来れば次の実行が取れるようにする。
 */
export async function acquireLease(name: string, ttlMs: number): Promise<boolean> {
  const until = new Date(Date.now() + ttlMs);
  const rows = await db
    .insert(jobLeases)
    .values({ name, lockedUntil: until })
    .onConflictDoUpdate({ target: jobLeases.name, set: { lockedUntil: until }, setWhere: lt(jobLeases.lockedUntil, new Date()) })
    .returning({ name: jobLeases.name });
  return rows.length > 0;
}

export async function releaseLease(name: string): Promise<void> {
  await db.update(jobLeases).set({ lockedUntil: new Date() }).where(eq(jobLeases.name, name));
}
