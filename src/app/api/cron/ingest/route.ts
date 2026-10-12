// 取り込みの口（Vercel Cron などから Authorization: Bearer <CRON_SECRET> 付きで呼ぶ）
// 10分ごとに呼ばれ、1回あたり約4分の締め切りの中で「一覧の取得」と「待ち行列の続き」を処理する
import { timingSafeEqual } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { dataSources, ingestRuns } from "@/db/schema";
import { todayJst } from "@/lib/dates";
import { acquireLease, closeAbandonedRuns, drainQueue, enqueueDueSources, isQueuedKind, pruneQueue, releaseLease } from "@/lib/ingest/queue";
import { runSource } from "@/lib/ingest/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 1回の実行で使う時間（上限 300 秒に対して余裕を持たせる） */
const BUDGET_MS = 240_000;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  // 前の実行がまだ動いていれば、重ねて走らせない（札の期限は上限の300秒より少し長くする）
  if (!(await acquireLease("ingest", 310_000))) return Response.json({ ok: true, skipped: "前の取り込みがまだ実行中です" });
  try {
    return await run();
  } finally {
    await releaseLease("ingest");
  }
}

async function run() {
  const deadline = Date.now() + BUDGET_MS;
  await pruneQueue();
  const abandoned = await closeAbandonedRuns();

  // 待ち行列を使わない種類（JSONフィード等）は、従来どおり1日1回まとめて実行する
  const today = todayJst();
  const others = (await db.select().from(dataSources).where(and(eq(dataSources.enabled, true), eq(dataSources.termsConfirmed, true)))).filter(
    (s) => !isQueuedKind(s.kind),
  );
  let othersRun = 0;
  for (const s of others) {
    if (Date.now() > deadline) break;
    const [already] = await db
      .select({ id: ingestRuns.id })
      .from(ingestRuns)
      .where(and(eq(ingestRuns.sourceId, s.id), gte(ingestRuns.startedAt, new Date(`${today}T00:00:00+09:00`))))
      .limit(1);
    if (already) continue;
    await runSource(s);
    othersRun++;
  }

  const enqueued = await enqueueDueSources(deadline);
  const drained = await drainQueue(deadline);
  return Response.json({ ok: true, abandoned, othersRun, enqueued, ...drained });
}
