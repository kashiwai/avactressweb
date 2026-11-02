// すべての取り込み元を「いま」最新まで取り込む（管理画面のcronを待たずに一括で流す）
//   bun --env-file=.env.local --conditions=react-server scripts/ingest-now.ts
//   ... --source=12      1つの取り込み元だけ
//   ... --max-minutes=30 30分で切り上げ（残りはcronが続きを処理）
import { db } from "../src/db";
import { dataSources } from "../src/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { acquireLease, drainQueue, enqueueSource, isQueuedKind, releaseLease } from "../src/lib/ingest/queue";
import { runSource } from "../src/lib/ingest/run";

const sourceArg = process.argv.find((a) => a.startsWith("--source="));
const maxArg = process.argv.find((a) => a.startsWith("--max-minutes="));
const drainOnly = process.argv.includes("--drain-only");
const onlyId = sourceArg ? Number(sourceArg.split("=")[1]) : 0;
const maxMinutes = maxArg ? Number(maxArg.split("=")[1]) : 0;
const deadline = maxMinutes > 0 ? Date.now() + maxMinutes * 60_000 : Number.POSITIVE_INFINITY;

const list = await db
  .select()
  .from(dataSources)
  .where(and(eq(dataSources.enabled, true), eq(dataSources.termsConfirmed, true)))
  .orderBy(asc(dataSources.id));
const targets = onlyId ? list.filter((s) => s.id === onlyId) : list;
if (targets.length === 0) throw new Error("有効かつ規約確認済みの取り込み元がありません");
// cron と同時に走らないよう、実行中の札を取る（終わらなければ期限切れで自動的に外れる）
const leaseMs = maxMinutes > 0 ? maxMinutes * 60_000 + 60_000 : 6 * 60 * 60_000;
let acquired = false;
for (let i = 0; i < 10 && !acquired; i++) {
  acquired = await acquireLease("ingest", leaseMs);
  if (!acquired) await new Promise((r) => setTimeout(r, 30_000));
}
if (!acquired) throw new Error("いま自動の取り込みが実行中です。数分おいてから、もう一度お試しください");

console.log(`対象 ${targets.length}件`);
if (drainOnly) {
  console.log("既存の待ち行列だけを処理します（一覧の再取得なし）");
} else {
  for (const s of targets) {
    if (Date.now() > deadline) break;
    if (isQueuedKind(s.kind)) {
      const q = await enqueueSource(s, { force: true, deadline: Math.min(deadline, Date.now() + 60_000) });
      console.log(`enqueue #${s.id} ${s.kind} ${s.name}: queued=${q.queued}${q.error ? ` error=${q.error}` : ""}`);
    } else {
      const r = await runSource(s);
      console.log(`run #${s.id} ${s.kind} ${s.name}: ok=${r.ok} applied=${r.applied}${r.error ? ` error=${r.error}` : ""}`);
    }
  }
}

let applied = 0;
let processed = 0;
while (Date.now() < deadline) {
  const d = await drainQueue(Math.min(deadline, Date.now() + 60_000));
  processed += d.processed;
  applied += d.applied;
  console.log(`drain processed=${processed} applied=${applied} errors=${d.errors} remaining=${d.remaining}`);
  if (d.remaining === 0) break;
}
console.log("完了（残りは10分ごとのcronが続きを処理します）");
await releaseLease("ingest");
process.exit(0);
