// まとめサイト型の取り込み（avzoku 等）。女優・店舗・在籍・出勤をページから作成／更新する
import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { actresses, enrollments, schedules, shops, type DataSource } from "@/db/schema";
import { todayJst } from "../dates";
import { parseAvzokuActress, parseAvzokuList, type AvzokuActress } from "./avzoku";
import { USER_AGENT, checkRobots } from "./robots";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getHtml(url: string): Promise<string> {
  const robots = await checkRobots(url);
  if (!robots.allowed) throw new Error(`${robots.reason}（${url}）`);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`取得に失敗しました（HTTP ${res.status}：${url}）`);
  return res.text();
}

export type AggregatorResult = { fetched: number; applied: number; unmatched: string[]; createdActresses: number; createdShops: number; errors: string[] };

/** 1人分を反映する。掲載停止中の女優も在籍・出勤は更新するが、公開側では表示されない */
export async function applyAggregatedActress(a: AvzokuActress, today: string): Promise<{ applied: number; createdActress: boolean; createdShop: boolean }> {
  const prefCode = a.prefCode;
  if (!prefCode) return { applied: 0, createdActress: false, createdShop: false };
  return db.transaction(async (tx) => {
    let createdActress = false;
    let createdShop = false;

    let [act] = await tx.select().from(actresses).where(eq(actresses.name, a.name)).limit(1);
    if (!act) {
      [act] = await tx.insert(actresses).values({ name: a.name, kana: a.kana, sourceImageUrl: a.imageUrl || "" }).returning();
      createdActress = true;
    } else {
      const patch: { kana?: string; sourceImageUrl?: string; updatedAt?: Date } = {};
      if (!act.kana && a.kana) patch.kana = a.kana;
      if (!act.sourceImageUrl && a.imageUrl) patch.sourceImageUrl = a.imageUrl;
      if (Object.keys(patch).length) {
        await tx.update(actresses).set({ ...patch, updatedAt: new Date() }).where(eq(actresses.id, act.id));
      }
    }

    let [shop] = await tx.select().from(shops).where(and(eq(shops.name, a.shopName), eq(shops.prefCode, prefCode))).limit(1);
    if (!shop) {
      [shop] = await tx.insert(shops).values({ name: a.shopName, prefCode, area: a.area, genre: a.genre, officialUrl: a.shopUrl }).returning();
      createdShop = true;
    }

    const verifiedAt = a.verifiedAt ?? today;
    const [enr] = await tx
      .insert(enrollments)
      .values({ actressId: act.id, shopId: shop.id, shopDisplayName: a.displayName, sourceUrl: a.url, sourceNote: "許可済みまとめサイトの掲載情報（自動取り込み）", verifiedAt })
      .onConflictDoUpdate({
        target: [enrollments.actressId, enrollments.shopId],
        // 運営者が手で「退店」にしたものは戻さない。表示名・根拠URL・確認日だけ更新する
        set: { shopDisplayName: a.displayName, sourceUrl: a.url, verifiedAt: sql`greatest(${enrollments.verifiedAt}, excluded.verified_at)`, updatedAt: new Date() },
      })
      .returning();

    let applied = 0;
    const blankDates: string[] = [];
    for (const s of a.schedules) {
      if (s.date < today) continue; // 過去日は上書きしない（履歴を保つ）
      if (!s.start || !s.end) {
        blankDates.push(s.date);
        continue;
      }
      await tx
        .insert(schedules)
        .values({ enrollmentId: enr.id, workDate: s.date, status: "working", startTime: s.start, endTime: s.end, origin: "ingest" })
        .onConflictDoUpdate({
          target: [schedules.enrollmentId, schedules.workDate],
          set: { status: "working", startTime: s.start, endTime: s.end, origin: "ingest", updatedAt: new Date() },
          // 運営者・お店が手で入れた予定は上書きしない
          setWhere: eq(schedules.origin, "ingest"),
        });
      applied++;
    }
    // 掲載元で予定が消えた日は、自動取り込みで入れた行だけ消して「未定」に戻す
    if (blankDates.length) {
      await tx
        .delete(schedules)
        .where(and(eq(schedules.enrollmentId, enr.id), inArray(schedules.workDate, blankDates), eq(schedules.origin, "ingest")));
    }
    return { applied, createdActress, createdShop };
  });
}

export async function runAvzoku(source: DataSource): Promise<AggregatorResult> {
  const today = todayJst();
  const result: AggregatorResult = { fetched: 0, applied: 0, unmatched: [], createdActresses: 0, createdShops: 0, errors: [] };

  // 1) 一覧ページ（日付のページ送り）から女優ページを集める
  const actressUrls = new Set<string>();
  let url: string | null = source.url;
  for (let page = 0; url && page < source.maxPages; page++) {
    const list = parseAvzokuList(await getHtml(url));
    list.actressUrls.forEach((u) => actressUrls.add(u));
    url = list.nextUrl;
    await sleep(1000);
  }
  if (actressUrls.size === 0) throw new Error("一覧ページから女優を1人も読み取れませんでした。ページの作りが変わった可能性があります");

  // 2) 女優ページを1件ずつ読む（1秒間隔）
  for (const u of actressUrls) {
    try {
      const a = parseAvzokuActress(await getHtml(u), u, today);
      result.fetched++;
      if (!a) {
        result.unmatched.push(u);
      } else if (!a.prefCode) {
        result.unmatched.push(`${a.name}（都道府県不明）`);
      } else {
        const r = await applyAggregatedActress(a, today);
        result.applied += r.applied;
        if (r.createdActress) result.createdActresses++;
        if (r.createdShop) result.createdShops++;
      }
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
      if (result.errors.length >= 10) throw new Error(`エラーが続いたため中断しました：${result.errors[0]}`);
    }
    await sleep(1000);
  }
  return result;
}
