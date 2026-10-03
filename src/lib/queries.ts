// 公開画面向けのデータ取得。掲載停止・非公開・退店は必ずここで除外する
import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { actresses, enrollments, schedules, shops, affiliateLinks, ingestRuns } from "@/db/schema";
import { addDays, todayJst, weekdayIndex } from "./dates";

/** 公開してよい在籍の条件 */
const visible = and(
  eq(actresses.isPublished, true),
  eq(actresses.optedOut, false),
  eq(shops.isPublished, true),
  eq(enrollments.status, "active"),
);

export type WorkingRow = {
  actressId: number;
  actressName: string;
  actressKana: string;
  imageUrl: string;
  shopId: number;
  shopName: string;
  prefCode: number;
  area: string;
  genre: string;
  shopDisplayName: string;
  startTime: string | null;
  endTime: string | null;
};

/** 指定日に出勤予定の女優（都道府県・キーワードで絞り込み） */
export async function getWorkingOn(date: string, opts: { prefCode?: number; q?: string; genre?: string } = {}): Promise<WorkingRow[]> {
  const conds = [visible, eq(schedules.workDate, date), eq(schedules.status, "working")];
  if (opts.prefCode) conds.push(eq(shops.prefCode, opts.prefCode));
  if (opts.genre) conds.push(eq(shops.genre, opts.genre));
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(actresses.name, like), ilike(actresses.kana, like), ilike(shops.name, like), ilike(shops.area, like))!);
  }
  return db
    .select({
      actressId: actresses.id,
      actressName: actresses.name,
      actressKana: actresses.kana,
      imageUrl: actresses.imageUrl,
      shopId: shops.id,
      shopName: shops.name,
      prefCode: shops.prefCode,
      area: shops.area,
      genre: shops.genre,
      shopDisplayName: enrollments.shopDisplayName,
      startTime: schedules.startTime,
      endTime: schedules.endTime,
    })
    .from(schedules)
    .innerJoin(enrollments, eq(enrollments.id, schedules.enrollmentId))
    .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
    .innerJoin(shops, eq(shops.id, enrollments.shopId))
    .where(and(...conds))
    .orderBy(asc(schedules.startTime), asc(actresses.kana));
}

/** 都道府県ごとの本日出勤人数 */
export async function getWorkingCountByPref(date: string): Promise<Map<number, number>> {
  const rows = await db
    .select({ prefCode: shops.prefCode, n: sql<number>`count(distinct ${actresses.id})::int` })
    .from(schedules)
    .innerJoin(enrollments, eq(enrollments.id, schedules.enrollmentId))
    .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
    .innerJoin(shops, eq(shops.id, enrollments.shopId))
    .where(and(visible, eq(schedules.workDate, date), eq(schedules.status, "working")))
    .groupBy(shops.prefCode);
  return new Map(rows.map((r) => [r.prefCode, r.n]));
}

export async function getSiteStats() {
  const today = todayJst();
  const [a] = await db
    .select({ n: sql<number>`count(distinct ${actresses.id})::int` })
    .from(enrollments)
    .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
    .innerJoin(shops, eq(shops.id, enrollments.shopId))
    .where(visible);
  const [s] = await db.select({ n: sql<number>`count(*)::int` }).from(shops).where(eq(shops.isPublished, true));
  const [w] = await db
    .select({ n: sql<number>`count(distinct ${actresses.id})::int` })
    .from(schedules)
    .innerJoin(enrollments, eq(enrollments.id, schedules.enrollmentId))
    .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
    .innerJoin(shops, eq(shops.id, enrollments.shopId))
    .where(and(visible, eq(schedules.workDate, today), eq(schedules.status, "working")));
  const [u] = await db.select({ at: sql<Date | null>`max(${schedules.updatedAt})` }).from(schedules);
  const [r] = await db.select({ at: sql<Date | null>`max(${ingestRuns.finishedAt})` }).from(ingestRuns).where(eq(ingestRuns.ok, true));
  const lastUpdated = [u?.at, r?.at].filter(Boolean).map((d) => new Date(d as Date)).sort((x, y) => y.getTime() - x.getTime())[0] ?? null;
  return { actressCount: a?.n ?? 0, shopCount: s?.n ?? 0, workingToday: w?.n ?? 0, lastUpdated };
}

/** 女優一覧（在籍中の店がある女優のみ） */
export const PAGE_SIZE = 60;

export async function listActresses(opts: { q?: string; prefCode?: number; page?: number } = {}) {
  const today = todayJst();
  const conds = [visible];
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(actresses.name, like), ilike(actresses.kana, like))!);
  }
  if (opts.prefCode) conds.push(eq(shops.prefCode, opts.prefCode));
  return db
    .select({
      id: actresses.id,
      name: actresses.name,
      kana: actresses.kana,
      imageUrl: actresses.imageUrl,
      shopCount: sql<number>`count(distinct ${shops.id})::int`,
      shopNames: sql<string[]>`array_agg(distinct ${shops.name})`,
      prefCodes: sql<number[]>`array_agg(distinct ${shops.prefCode})`,
      workingToday: sql<boolean>`bool_or(exists(select 1 from ${schedules} s where s.enrollment_id = ${enrollments.id} and s.work_date = ${today} and s.status = 'working'))`,
    })
    .from(enrollments)
    .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
    .innerJoin(shops, eq(shops.id, enrollments.shopId))
    .where(and(...conds))
    .groupBy(actresses.id)
    .orderBy(asc(actresses.kana), asc(actresses.name))
    .limit(PAGE_SIZE + 1)
    .offset(((opts.page ?? 1) - 1) * PAGE_SIZE);
}

export async function getPublicActress(id: number) {
  const [a] = await db
    .select()
    .from(actresses)
    .where(and(eq(actresses.id, id), eq(actresses.isPublished, true), eq(actresses.optedOut, false)))
    .limit(1);
  if (!a) return null;

  const enr = await db
    .select({
      enrollmentId: enrollments.id,
      shopDisplayName: enrollments.shopDisplayName,
      sourceUrl: enrollments.sourceUrl,
      verifiedAt: enrollments.verifiedAt,
      shop: shops,
    })
    .from(enrollments)
    .innerJoin(shops, eq(shops.id, enrollments.shopId))
    .where(and(eq(enrollments.actressId, id), eq(enrollments.status, "active"), eq(shops.isPublished, true)));

  const today = todayJst();
  const ids = enr.map((e) => e.enrollmentId);
  const sch = ids.length
    ? await db
        .select()
        .from(schedules)
        .where(and(inArray(schedules.enrollmentId, ids), gte(schedules.workDate, addDays(today, -90)), lte(schedules.workDate, addDays(today, 30))))
    : [];

  const links = await db
    .select()
    .from(affiliateLinks)
    .where(and(eq(affiliateLinks.actressId, id), eq(affiliateLinks.enabled, true)))
    .orderBy(asc(affiliateLinks.sortOrder), asc(affiliateLinks.id));

  return { actress: a, enrollments: enr, schedules: sch, links, insight: buildInsight(sch, today) };
}

export type AttendanceInsight = {
  /** 直近90日の出勤日数 */
  workedDays90: number;
  /** 曜日ごとの出勤回数（日〜土） */
  byWeekday: number[];
  /** よく出勤する曜日（上位） */
  topWeekdays: number[];
  /** 次の出勤日（今日を含む） */
  nextWorkDate: string | null;
  /** 今後30日の出勤予定日数 */
  upcomingDays: number;
};

/** 出勤履歴から傾向を出す（「よく出勤する曜日」「次の出勤日」） */
export function buildInsight(rows: Array<{ workDate: string; status: "working" | "off" }>, today: string): AttendanceInsight {
  const from = addDays(today, -90);
  const workedDates = new Set<string>();
  const upcoming = new Set<string>();
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) {
    if (r.status !== "working") continue;
    if (r.workDate >= from && r.workDate < today && !workedDates.has(r.workDate)) {
      workedDates.add(r.workDate);
      byWeekday[weekdayIndex(r.workDate)]++;
    }
    if (r.workDate >= today) upcoming.add(r.workDate);
  }
  const max = Math.max(...byWeekday);
  const topWeekdays = max > 0 ? byWeekday.map((n, i) => ({ n, i })).filter((x) => x.n >= max * 0.8).map((x) => x.i) : [];
  const nextWorkDate = [...upcoming].sort()[0] ?? null;
  return { workedDays90: workedDates.size, byWeekday, topWeekdays, nextWorkDate, upcomingDays: upcoming.size };
}

export async function listPublicShops(opts: { prefCode?: number; q?: string; genre?: string; page?: number } = {}) {
  const today = todayJst();
  const conds = [eq(shops.isPublished, true)];
  if (opts.prefCode) conds.push(eq(shops.prefCode, opts.prefCode));
  if (opts.genre) conds.push(eq(shops.genre, opts.genre));
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(shops.name, like), ilike(shops.area, like), ilike(shops.genre, like))!);
  }
  return db
    .select({
      shop: shops,
      avCount: sql<number>`(select count(*)::int from ${enrollments} e join ${actresses} a on a.id = e.actress_id where e.shop_id = "shops"."id" and e.status = 'active' and a.is_published and not a.opted_out)`,
      workingToday: sql<number>`(select count(distinct e.actress_id)::int from ${enrollments} e join ${actresses} a on a.id = e.actress_id join ${schedules} s on s.enrollment_id = e.id where e.shop_id = "shops"."id" and e.status = 'active' and a.is_published and not a.opted_out and s.work_date = ${today} and s.status = 'working')`,
    })
    .from(shops)
    .where(and(...conds))
    .orderBy(asc(shops.prefCode), asc(shops.name))
    .limit(opts.page ? PAGE_SIZE + 1 : 10000)
    .offset(opts.page ? (opts.page - 1) * PAGE_SIZE : 0);
}

export async function getPublicShop(id: number, days = 7) {
  const [shop] = await db.select().from(shops).where(and(eq(shops.id, id), eq(shops.isPublished, true))).limit(1);
  if (!shop) return null;
  const enr = await db
    .select({ enrollment: enrollments, actress: actresses })
    .from(enrollments)
    .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
    .where(and(eq(enrollments.shopId, id), eq(enrollments.status, "active"), eq(actresses.isPublished, true), eq(actresses.optedOut, false)))
    .orderBy(asc(actresses.kana));
  const today = todayJst();
  const ids = enr.map((e) => e.enrollment.id);
  const sch = ids.length
    ? await db
        .select()
        .from(schedules)
        .where(and(inArray(schedules.enrollmentId, ids), gte(schedules.workDate, today), lte(schedules.workDate, addDays(today, days - 1))))
    : [];
  return { shop, enrollments: enr, schedules: sch };
}

/** 新しく在籍が確認された女優（トップの「新着」用） */
export async function getRecentEnrollments(limit = 6) {
  return db
    .select({
      actressId: actresses.id,
      actressName: actresses.name,
      imageUrl: actresses.imageUrl,
      shopId: shops.id,
      shopName: shops.name,
      prefCode: shops.prefCode,
      createdAt: enrollments.createdAt,
    })
    .from(enrollments)
    .innerJoin(actresses, eq(actresses.id, enrollments.actressId))
    .innerJoin(shops, eq(shops.id, enrollments.shopId))
    .where(visible)
    .orderBy(desc(enrollments.createdAt))
    .limit(limit);
}

/** 公開中の女優の名前一覧（削除依頼フォームの選択肢用） */
export async function listActressNamesForRemoval() {
  return db
    .select({ id: actresses.id, name: actresses.name })
    .from(actresses)
    .where(and(eq(actresses.isPublished, true), eq(actresses.optedOut, false)))
    .orderBy(asc(actresses.kana));
}
