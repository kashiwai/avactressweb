// 確認待ち（candidate_girls）を、名前の飾りを取り除いたうえで女優と照合し直す
//
// 使い方: bun --env-file=.env.local scripts/rematch-candidates.ts [--apply]
//         --apply を付けないときは、一致した組み合わせを表示するだけ（DBは変えない）
//
// 規則:
//  - 「名前/よみ」「名前・宣伝文句」「名前☆宣伝文句」「名前【…】」「新人○○」「○○(AV女優)」などの
//    飾りを取り除いた名前・よみを作り、掲載中の女優の名前・よみがなと完全一致で1人に定まったときだけ結び付ける
//  - 部分一致・あいまい一致はしない。伏せ字（〇○◯◎●＊*）入り・途中で切れた名前（…/...）は照合しない
//  - 出勤は作らない（ファイル取り込み時に出勤スケジュールがあった人は、取り込み直しで反映される）
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { todayJst } from "../src/lib/dates";

const { actresses, candidateGirls, enrollments, shops } = schema;

const MASK = /[〇○◯◎●＊*]/;
const TRUNCATED = /\.\.\.|…/;

function norm(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s　]+/g, "")
    .replace(/(ちゃん|さん|様)$/, "");
}

/** 源氏名から照合用の名前（と、併記されていれば読み）を取り出す */
function nameKeys(raw: string): string[] {
  if (MASK.test(raw) || TRUNCATED.test(raw)) return [];
  let s = raw.normalize("NFKC").trim();
  s = s.replace(/[【\[［(（][^】\]］)）]*[】\]］)）]/g, " "); // 括弧書きを除く
  s = s.replace(/^(新人|NEW|★|☆|◆)+/i, "");
  const keys = new Set<string>();
  // 「名前/よみ」「名前・宣伝」「名前☆宣伝」「名前＠宣伝」
  const [head, ...rest] = s.split(/[/／]/);
  const main = head.split(/[・•☆★♡♥♪@＠※]/)[0];
  const cleaned = main.replace(/(現役)?(AV|ＡＶ)?(女優|嬢)$/i, "").replace(/(単体AV|単体)$/i, "").trim();
  if (cleaned) keys.add(norm(cleaned));
  // 「王妃瑠璃/おうひるり」のように読みが併記されている場合は、読みも照合に使う
  const reading = rest[0]?.split(/[・•☆★♡♥♪@＠※]/)[0]?.trim();
  if (reading && /^[ぁ-んァ-ヶー\s]+$/.test(reading)) keys.add(norm(reading));
  return [...keys].filter((k) => k.length >= 2);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });
  const today = todayJst();

  const acts = await db
    .select({ id: actresses.id, name: actresses.name, kana: actresses.kana })
    .from(actresses)
    .where(and(eq(actresses.isPublished, true), eq(actresses.optedOut, false)));
  const byKey = new Map<string, Set<number>>();
  for (const a of acts) {
    for (const k of [norm(a.name), a.kana ? norm(a.kana) : ""]) {
      if (k.length < 2) continue;
      if (!byKey.has(k)) byKey.set(k, new Set());
      byKey.get(k)!.add(a.id);
    }
  }
  const actName = new Map(acts.map((a) => [a.id, a.name]));

  const pending = await db.select().from(candidateGirls).where(eq(candidateGirls.status, "pending"));
  const hits: Array<{ c: (typeof pending)[number]; actressId: number }> = [];
  let ambiguous = 0;
  for (const c of pending) {
    const ids = new Set<number>();
    for (const k of nameKeys(c.displayName)) for (const id of byKey.get(k) ?? []) ids.add(id);
    if (ids.size === 1) hits.push({ c, actressId: [...ids][0] });
    else if (ids.size > 1) ambiguous++;
  }

  for (const { c, actressId } of hits) {
    console.log(`${c.displayName}\t→ ${actName.get(actressId)}\t(${c.shopName})`);
    if (!apply) continue;
    const [found] = await db
      .select({ id: shops.id })
      .from(shops)
      .where(and(eq(shops.name, c.shopName), eq(shops.prefCode, c.prefCode)))
      .limit(1);
    const shopId =
      found?.id ??
      (await db
        .insert(shops)
        .values({ name: c.shopName, prefCode: c.prefCode, area: c.area, genre: c.genre, officialUrl: c.shopUrl })
        .returning({ id: shops.id }))[0].id;
    await db
      .insert(enrollments)
      .values({
        actressId,
        shopId,
        shopDisplayName: c.displayName,
        sourceUrl: c.girlUrl,
        sourceNote: "シティヘブン「セクシー女優」掲載（名前の飾りを除いて完全一致）",
        verifiedAt: today,
      })
      .onConflictDoNothing();
    await db
      .update(candidateGirls)
      .set({ status: "linked", linkedActressId: actressId, decidedAt: new Date(), note: "自動照合：名前の飾りを除いて完全一致" })
      .where(eq(candidateGirls.id, c.id));
  }

  console.log(`${apply ? "" : "[dry-run] "}pending=${pending.length} matched=${hits.length} ambiguous=${ambiguous}`);
  await client.end();
}

main().catch((e) => {
  console.error("rematch failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
