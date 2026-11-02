// 店舗の公式ページ（シティヘブン）の週間シフトを読み、源氏名で照合して出勤を更新する
//
// 使い方:
//   bun --env-file=.env.local --conditions=react-server scripts/sync-shop-shifts.ts            # 確認のみ
//   bun --env-file=.env.local --conditions=react-server scripts/sync-shop-shifts.ts --apply    # 反映
//   ... --limit=20 / --shop=123 / --max-minutes=30
import { db } from "../src/db";
import { actresses, enrollments, schedules, shops } from "../src/db/schema";
import { and, asc, eq, like, sql } from "drizzle-orm";
import { todayJst } from "../src/lib/dates";
import { cityheavenAttendUrl, parseCityheavenWeekly, parseCityheavenWeeklyPages, type ShopShiftGirl } from "../src/lib/ingest/cityheaven-shop";
import { normalizePersonName } from "../src/lib/ingest/normalize";
import { USER_AGENT } from "../src/lib/ingest/robots";

const apply = process.argv.includes("--apply");
const shopArg = process.argv.find((a) => a.startsWith("--shop="));
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const maxArg = process.argv.find((a) => a.startsWith("--max-minutes="));
const onlyShop = shopArg ? Number(shopArg.split("=")[1]) : 0;
const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;
const maxMinutes = maxArg ? Number(maxArg.split("=")[1]) : 0;
const deadline = maxMinutes > 0 ? Date.now() + maxMinutes * 60_000 : Number.POSITIVE_INFINITY;
const today = todayJst();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const shopsToSync = await db
  .select({ id: shops.id, name: shops.name, officialUrl: shops.officialUrl })
  .from(shops)
  .where(
    and(
      eq(shops.isPublished, true),
      like(shops.officialUrl, "%cityheaven.net%"),
      sql`exists (select 1 from ${enrollments} e where e.shop_id = ${shops.id} and e.status = 'active')`,
      ...(onlyShop ? [eq(shops.id, onlyShop)] : []),
    ),
  )
  .orderBy(asc(shops.id))
  .limit(limit > 0 ? limit : 100000);

console.log(`対象店舗 ${shopsToSync.length}件（${apply ? "反映" : "確認のみ"}）`);
let shopsDone = 0, girlsRead = 0, matched = 0, schedulesWritten = 0, notFound = 0, errors = 0;

for (const shop of shopsToSync) {
  if (Date.now() > deadline) break;
  try {
    const base = cityheavenAttendUrl(shop.officialUrl);
    const first = await getHtml(base);
    const urls = [base, ...parseCityheavenWeeklyPages(first, base).filter((u) => u !== base)];
    const girls = new Map<string, ShopShiftGirl>();
    for (const { url, html } of urls.map((u, i) => ({ url: u, html: i === 0 ? first : "" }))) {
      const pageHtml = html || (await getHtml(url));
      for (const g of parseCityheavenWeekly(pageHtml, url, today)) {
        const key = normalizePersonName(g.displayName);
        if (key && !girls.has(key)) girls.set(key, g);
      }
      if (!html) await sleep(800);
    }
    girlsRead += girls.size;

    const enr = await db
      .select({ id: enrollments.id, displayName: enrollments.shopDisplayName, actressId: enrollments.actressId })
      .from(enrollments)
      .where(and(eq(enrollments.shopId, shop.id), eq(enrollments.status, "active")));
    for (const e of enr) {
      const g = girls.get(normalizePersonName(e.displayName));
      if (!g) { notFound++; continue; }
      matched++;
      const rows = g.days
        .filter((d) => d.date >= today)
        .map((d) => ({ enrollmentId: e.id, workDate: d.date, status: d.status, startTime: d.start, endTime: d.end, origin: "shop" as const }));
      if (rows.length === 0) continue;
      if (apply) {
        await db
          .insert(schedules)
          .values(rows)
          .onConflictDoUpdate({
            target: [schedules.enrollmentId, schedules.workDate],
            set: {
              status: sql`excluded.status`,
              startTime: sql`excluded.start_time`,
              endTime: sql`excluded.end_time`,
              origin: "shop",
              updatedAt: new Date(),
            },
            // 手で入れた予定は上書きしない。集約サイトの予定は店ページの予定で上書きする
            setWhere: sql`${schedules.origin} <> 'manual'`,
          });
      }
      schedulesWritten += rows.length;
    }
    shopsDone++;
    console.log(`#${shop.id} ${shop.name}: 女の子${girls.size}人 / 照合${matched}人 / 予定${schedulesWritten}件`);
  } catch (e) {
    errors++;
    console.log(`#${shop.id} ${shop.name}: エラー ${e instanceof Error ? e.message : e}`);
  }
  await sleep(800);
}

console.log({ shops: shopsToSync.length, shopsDone, girlsRead, matched, schedulesWritten, notFound, errors, apply });
process.exit(0);
