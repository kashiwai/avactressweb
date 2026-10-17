// 作品の表紙（jacket）が写真になっている女優のうち、DUGA の顔写真がある人を顔写真に置き換える
// 使い方: bun --env-file=.env.local scripts/upgrade-duga-faces.ts [--dry-run]（本番は DATABASE_URL を指定）
import { and, eq, isNotNull, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const { actresses } = schema;
const dryRun = process.argv.includes("--dry-run");
const url = process.env.DATABASE_URL!;
const client = postgres(url, { max: 1, prepare: !/:6543\//.test(url) });
const db = drizzle(client, { schema });

const rows = await db
  .select({ id: actresses.id, pid: actresses.dugaPerformerId })
  .from(actresses)
  .where(and(isNotNull(actresses.dugaPerformerId), like(actresses.imageUrl, "%pic.duga.jp/%/jacket%")));
let upgraded = 0, none = 0;
for (const r of rows) {
  const face = `https://img.duga.jp/img/actress/160x160/${r.pid}.jpg`;
  const res = await fetch(face, { method: "HEAD" }).catch(() => null);
  if (res?.ok && (res.headers.get("content-type") ?? "").startsWith("image/")) {
    if (!dryRun) await db.update(actresses).set({ imageUrl: face }).where(eq(actresses.id, r.id));
    upgraded++;
  } else none++;
  await new Promise((ok) => setTimeout(ok, 500));
}
console.log(`${dryRun ? "[dry-run] " : ""}targets=${rows.length} upgraded=${upgraded} noFace=${none}`);
await client.end();
