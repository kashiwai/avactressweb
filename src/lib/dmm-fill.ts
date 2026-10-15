// DMM の女優検索で、女優の写真と DMM の女優IDを補う（自動実行・管理画面の両方から使う）
// 名前が完全一致で1人に定まったときだけ入れる。同名が複数・見つからない女優は触らない
import "server-only";
import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { actresses } from "@/db/schema";
import { dmmConfigured, searchDmmActress } from "@/lib/dmm";

/** 見つからなかった女優を問い合わせ直すまでの日数（DMM 側に後から登録されることがあるため） */
const RECHECK_DAYS = 30;
const normName = (s: string) => s.replace(/[\s　]/g, "");

export type DmmFillResult = { checked: number; updated: number; ambiguous: number; notFound: number; failed: number; remaining: number };

export async function fillDmmPhotos(deadline: number): Promise<DmmFillResult> {
  const r: DmmFillResult = { checked: 0, updated: 0, ambiguous: 0, notFound: 0, failed: 0, remaining: 0 };
  if (!dmmConfigured()) return r;
  const due = and(
    isNull(actresses.dmmActressId),
    or(isNull(actresses.dmmCheckedAt), lt(actresses.dmmCheckedAt, new Date(Date.now() - RECHECK_DAYS * 86400_000))),
  );
  while (Date.now() < deadline) {
    const batch = await db
      .select({ id: actresses.id, name: actresses.name, imageUrl: actresses.imageUrl })
      .from(actresses)
      .where(due)
      .orderBy(sql`${actresses.dmmCheckedAt} asc nulls first`, asc(actresses.id))
      .limit(20);
    if (batch.length === 0) break;
    for (const t of batch) {
      if (Date.now() > deadline) break;
      const res = await searchDmmActress(t.name);
      r.checked++;
      if (!res.ok) {
        // 通信失敗は「問い合わせ済み」にしない（次の実行でもう一度試す）
        r.failed++;
        if (r.failed >= 5) return { ...r, remaining: await countDue(due) };
        continue;
      }
      const exact = res.items.filter((i) => normName(i.name) === normName(t.name));
      if (exact.length === 1) {
        await db
          .update(actresses)
          .set({ dmmActressId: exact[0].id, imageUrl: t.imageUrl || exact[0].imageUrl, dmmCheckedAt: new Date() })
          .where(eq(actresses.id, t.id));
        r.updated++;
      } else {
        await db.update(actresses).set({ dmmCheckedAt: new Date() }).where(eq(actresses.id, t.id));
        if (exact.length > 1) r.ambiguous++;
        else r.notFound++;
      }
      await new Promise((ok) => setTimeout(ok, 1100)); // 1秒に1件程度に抑える
    }
  }
  return { ...r, remaining: await countDue(due) };
}

async function countDue(due: ReturnType<typeof and>): Promise<number> {
  const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(actresses).where(due);
  return c?.n ?? 0;
}
