// 取り込みの実行。源氏名が在籍と完全一致したものだけ出勤に反映し、それ以外は「未照合」として記録する
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { dataSources, enrollments, ingestRuns, schedules, type DataSource } from "@/db/schema";
import { adapters } from "./adapters";
import { checkRobots } from "./robots";
import { runAvzoku } from "./aggregator";
import { runCityheaven } from "./cityheaven-run";

export type RunResult = { sourceId: number; ok: boolean; fetched: number; applied: number; unmatched: string[]; error?: string; createdActresses?: number; createdShops?: number };

export async function runSource(source: DataSource): Promise<RunResult> {
  const [run] = await db.insert(ingestRuns).values({ sourceId: source.id }).returning({ id: ingestRuns.id });
  const finish = async (r: Omit<RunResult, "sourceId">) => {
    await db
      .update(ingestRuns)
      .set({
        finishedAt: new Date(),
        ok: r.ok,
        fetchedCount: r.fetched,
        appliedCount: r.applied,
        unmatchedNames: r.unmatched,
        createdActresses: r.createdActresses ?? 0,
        createdShops: r.createdShops ?? 0,
        error: r.error ?? null,
      })
      .where(eq(ingestRuns.id, run.id));
    const status = r.ok ? `成功：${r.applied}件反映${r.unmatched.length ? `・未照合${r.unmatched.length}件` : ""}` : `失敗：${r.error}`;
    await db.update(dataSources).set({ lastRunAt: new Date(), lastStatus: status }).where(eq(dataSources.id, source.id));
    return { sourceId: source.id, ...r };
  };

  if (!source.termsConfirmed) return finish({ ok: false, fetched: 0, applied: 0, unmatched: [], error: "規約確認が済んでいないため実行しませんでした" });

  if (source.kind === "cityheaven") {
    try {
      const r = await runCityheaven(source);
      return finish({
        ok: r.errors.length === 0,
        fetched: r.workingGirls,
        applied: r.applied,
        unmatched: [
          `確認待ち ${r.pendingTotal}人（うち今回新規 ${r.newCandidates}人）`,
          ...r.errors.map((e) => `エラー：${e}`),
        ],
        createdShops: r.createdShops,
        error: r.errors.length ? r.errors[0] : undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ingest] cityheaven source=${source.id} failed: ${msg}`);
      return finish({ ok: false, fetched: 0, applied: 0, unmatched: [], error: msg });
    }
  }

  if (source.kind === "avzoku") {
    try {
      const r = await runAvzoku(source);
      return finish({
        ok: true,
        fetched: r.fetched,
        applied: r.applied,
        unmatched: [...r.unmatched, ...r.errors.map((e) => `エラー：${e}`)],
        createdActresses: r.createdActresses,
        createdShops: r.createdShops,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ingest] source=${source.id} failed: ${msg}`);
      return finish({ ok: false, fetched: 0, applied: 0, unmatched: [], error: msg });
    }
  }
  if (source.shopId == null) return finish({ ok: false, fetched: 0, applied: 0, unmatched: [], error: "JSONフィードには対象の店舗が必要です" });
  const shopId = source.shopId;

  try {
    const robots = await checkRobots(source.url);
    if (!robots.allowed) return finish({ ok: false, fetched: 0, applied: 0, unmatched: [], error: robots.reason });

    const items = await adapters.json_feed(source.url);

    const enr = await db
      .select({ id: enrollments.id, name: enrollments.shopDisplayName })
      .from(enrollments)
      .where(and(eq(enrollments.shopId, shopId), eq(enrollments.status, "active")));
    const byName = new Map(enr.map((e) => [e.name.trim(), e.id]));

    const unmatched = new Set<string>();
    let applied = 0;
    for (const it of items) {
      const enrollmentId = byName.get(it.castName.trim());
      if (!enrollmentId) {
        unmatched.add(it.castName);
        continue;
      }
      await db
        .insert(schedules)
        .values({ enrollmentId, workDate: it.date, startTime: it.start, endTime: it.end, status: it.status, origin: "ingest" })
        .onConflictDoUpdate({
          target: [schedules.enrollmentId, schedules.workDate],
          set: { startTime: it.start, endTime: it.end, status: it.status, origin: "ingest", updatedAt: sql`now()` },
        });
      applied++;
    }
    return finish({ ok: true, fetched: items.length, applied, unmatched: [...unmatched] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ingest] source=${source.id} failed: ${msg}`);
    return finish({ ok: false, fetched: 0, applied: 0, unmatched: [], error: msg });
  }
}

/** 有効かつ規約確認済みの取り込み元をすべて実行する（1件ずつ順番に・間隔を空ける） */
export async function runAllSources(): Promise<RunResult[]> {
  const list = await db.select().from(dataSources).where(and(eq(dataSources.enabled, true), eq(dataSources.termsConfirmed, true)));
  const results: RunResult[] = [];
  for (const s of list) {
    results.push(await runSource(s));
    await new Promise((r) => setTimeout(r, 1000));
  }
  return results;
}
