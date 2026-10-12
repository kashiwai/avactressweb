"use server";
// 管理画面の書き込み処理。各処理の冒頭で必ず権限を確認する
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, asc, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { actresses, affiliateLinks, dataSources, enrollments, removalRequests, schedules, shops, users } from "@/db/schema";
import { audit, getCurrentUser, hashPassword, requireAdmin, requireShop } from "@/lib/auth";
import { addDays, dateRange, isYmd, todayJst } from "@/lib/dates";
import { runSource } from "@/lib/ingest/run";
import { acquireLease, drainQueue, enqueueSource, isQueuedKind, releaseLease } from "@/lib/ingest/queue";
import { RECOMMENDED_SOURCES } from "@/lib/ingest/recommended";
import { ignoreCandidates, linkCandidate } from "@/lib/ingest/cityheaven-run";
import { GENRES } from "@/lib/genres";
import { dmmConfigured, searchDmmActress } from "@/lib/dmm";

export type FormState = { error?: string } | undefined;

const msg = (path: string, text: string) => `${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(text)}`;
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "入力内容を確認してください";
const idOf = (fd: FormData, key = "id") => {
  const n = Number(fd.get(key));
  if (!Number.isInteger(n) || n <= 0) throw new Error("invalid id");
  return n;
};
const bool = (fd: FormData, key: string) => fd.get(key) === "on";

const httpUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(1000)
    .refine((v) => /^https?:\/\/[^\s]+$/i.test(v), `${label}は http:// か https:// で始まるURLを入力してください`);
const optionalHttpUrl = (label: string) => z.union([z.literal(""), httpUrl(label)]);

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

/* ───────── 店舗 ───────── */

const shopSchema = z.object({
  name: z.string().trim().min(1, "店舗名を入力してください").max(100),
  prefCode: z.coerce.number().int().min(1, "都道府県を選んでください").max(47),
  area: z.string().trim().max(50),
  genre: z.enum(GENRES.map((g) => g.name) as [string, ...string[]], { message: "業種を選んでください" }),
  officialUrl: optionalHttpUrl("公式サイト"),
  phone: z.string().trim().max(30),
  businessHours: z.string().trim().max(100),
  description: z.string().trim().max(2000),
  anonymousAvCount: z.coerce.number().int().min(0, "人数は0以上で入力してください").max(999),
  anonymousAvSourceUrl: optionalHttpUrl("名前非公開の在籍数の根拠"),
});

function shopValues(fd: FormData) {
  const r = shopSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: firstIssue(r.error) } as const;
  if (r.data.anonymousAvCount > 0 && !r.data.anonymousAvSourceUrl) return { error: "名前非公開の在籍数を入れる場合は、根拠となる公表ページのURLも入力してください" } as const;
  return { data: { ...r.data, isPublished: bool(fd, "isPublished") } } as const;
}

export async function createShop(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const v = shopValues(fd);
  if ("error" in v) return { error: v.error };
  const [row] = await db.insert(shops).values(v.data).returning({ id: shops.id });
  await audit(u.id, "shop.create", `shop:${row.id}`, v.data.name);
  redirect(msg(`/admin/shops/${row.id}`, "店舗を登録しました"));
}

export async function updateShop(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const id = idOf(fd);
  const v = shopValues(fd);
  if ("error" in v) return { error: v.error };
  await db.update(shops).set({ ...v.data, updatedAt: new Date() }).where(eq(shops.id, id));
  await audit(u.id, "shop.update", `shop:${id}`);
  redirect(msg(`/admin/shops/${id}`, "店舗情報を保存しました"));
}

export async function deleteShop(fd: FormData): Promise<void> {
  const u = await requireAdmin();
  const id = idOf(fd);
  await db.delete(shops).where(eq(shops.id, id));
  await audit(u.id, "shop.delete", `shop:${id}`);
  redirect(msg("/admin/shops", "店舗を削除しました"));
}

/* ───────── 女優 ───────── */

const actressSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(100),
  kana: z.string().trim().max(100),
  dmmActressId: z.string().trim().regex(/^\d*$/, "DMM女優IDは数字で入力してください").max(20),
  imageUrl: optionalHttpUrl("画像URL"),
  profile: z.string().trim().max(3000),
});

function actressValues(fd: FormData) {
  const r = actressSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: firstIssue(r.error) } as const;
  return { data: { ...r.data, dmmActressId: r.data.dmmActressId || null, isPublished: bool(fd, "isPublished") } } as const;
}

export async function createActress(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const v = actressValues(fd);
  if ("error" in v) return { error: v.error };
  const [row] = await db.insert(actresses).values(v.data).returning({ id: actresses.id });
  await audit(u.id, "actress.create", `actress:${row.id}`, v.data.name);
  redirect(msg(`/admin/actresses/${row.id}`, "女優を登録しました"));
}

export async function updateActress(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const id = idOf(fd);
  const v = actressValues(fd);
  if ("error" in v) return { error: v.error };
  await db.update(actresses).set({ ...v.data, updatedAt: new Date() }).where(eq(actresses.id, id));
  await audit(u.id, "actress.update", `actress:${id}`);
  redirect(msg(`/admin/actresses/${id}`, "女優情報を保存しました"));
}

export async function deleteActress(fd: FormData): Promise<void> {
  const u = await requireAdmin();
  const id = idOf(fd);
  await db.delete(actresses).where(eq(actresses.id, id));
  await audit(u.id, "actress.delete", `actress:${id}`);
  redirect(msg("/admin/actresses", "女優を削除しました"));
}

/** 掲載停止／再開（本人・事務所からの依頼に対応） */
export async function setOptOut(fd: FormData): Promise<void> {
  const u = await requireAdmin();
  const id = idOf(fd);
  const optedOut = fd.get("optedOut") === "1";
  await db.update(actresses).set({ optedOut, updatedAt: new Date() }).where(eq(actresses.id, id));
  await audit(u.id, optedOut ? "actress.optout" : "actress.optin", `actress:${id}`);
  const back = String(fd.get("back") || `/admin/actresses/${id}`);
  redirect(msg(back.startsWith("/admin") ? back : `/admin/actresses/${id}`, optedOut ? "掲載を停止しました（公開画面から消えました）" : "掲載を再開しました"));
}

/* ───────── 外部リンク（myfans 等） ───────── */

const linkSchema = z.object({
  provider: z.enum(["fanza", "myfans", "other"], { message: "提供元を選んでください" }),
  label: z.string().trim().min(1, "表示名を入力してください").max(60),
  url: httpUrl("リンク先"),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function addLink(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const actressId = idOf(fd, "actressId");
  const r = linkSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: firstIssue(r.error) };
  await db.insert(affiliateLinks).values({ ...r.data, actressId });
  await audit(u.id, "link.create", `actress:${actressId}`, r.data.url);
  redirect(msg(`/admin/actresses/${actressId}`, "リンクを追加しました"));
}

export async function toggleLink(fd: FormData): Promise<void> {
  const u = await requireAdmin();
  const id = idOf(fd);
  const [l] = await db.select().from(affiliateLinks).where(eq(affiliateLinks.id, id));
  if (!l) redirect("/admin/actresses");
  await db.update(affiliateLinks).set({ enabled: !l.enabled }).where(eq(affiliateLinks.id, id));
  await audit(u.id, "link.toggle", `link:${id}`);
  redirect(msg(`/admin/actresses/${l.actressId}`, l.enabled ? "リンクを非表示にしました" : "リンクを表示にしました"));
}

export async function deleteLink(fd: FormData): Promise<void> {
  const u = await requireAdmin();
  const id = idOf(fd);
  const [l] = await db.delete(affiliateLinks).where(eq(affiliateLinks.id, id)).returning();
  await audit(u.id, "link.delete", `link:${id}`);
  redirect(msg(l ? `/admin/actresses/${l.actressId}` : "/admin/actresses", "リンクを削除しました"));
}

/* ───────── 在籍 ───────── */

const enrollmentSchema = z.object({
  actressId: z.coerce.number().int().min(1, "女優を選んでください"),
  shopId: z.coerce.number().int().min(1, "店舗を選んでください"),
  shopDisplayName: z.string().trim().min(1, "店での名前（源氏名）を入力してください").max(100),
  sourceUrl: httpUrl("在籍の根拠URL"),
  sourceNote: z.string().trim().max(500),
  verifiedAt: z.string().refine(isYmd, "確認日を正しく入力してください"),
  status: z.enum(["active", "left"]),
});

export async function createEnrollment(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const r = enrollmentSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: firstIssue(r.error) };
  try {
    const [row] = await db.insert(enrollments).values(r.data).returning({ id: enrollments.id });
    await audit(u.id, "enrollment.create", `enrollment:${row.id}`, r.data.sourceUrl);
    redirect(msg(`/admin/enrollments/${row.id}`, "在籍を登録しました。続けて出勤を入力できます"));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "この女優とこの店舗の在籍は、すでに登録されています" };
    throw e;
  }
}

export async function updateEnrollment(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const id = idOf(fd);
  const r = enrollmentSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: firstIssue(r.error) };
  try {
    await db.update(enrollments).set({ ...r.data, updatedAt: new Date() }).where(eq(enrollments.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "この女優とこの店舗の在籍は、すでに別に登録されています" };
    throw e;
  }
  await audit(u.id, "enrollment.update", `enrollment:${id}`);
  redirect(msg(`/admin/enrollments/${id}`, "在籍情報を保存しました"));
}

export async function deleteEnrollment(fd: FormData): Promise<void> {
  const u = await requireAdmin();
  const id = idOf(fd);
  await db.delete(enrollments).where(eq(enrollments.id, id));
  await audit(u.id, "enrollment.delete", `enrollment:${id}`);
  redirect(msg("/admin/enrollments", "在籍を削除しました"));
}

/** 根拠の再確認（確認日を今日に更新） */
export async function reverifyEnrollment(fd: FormData): Promise<void> {
  const u = await requireAdmin();
  const id = idOf(fd);
  await db.update(enrollments).set({ verifiedAt: todayJst(), updatedAt: new Date() }).where(eq(enrollments.id, id));
  await audit(u.id, "enrollment.reverify", `enrollment:${id}`);
  const back = String(fd.get("back") || `/admin/enrollments/${id}`);
  redirect(msg(back.startsWith("/admin") ? back : `/admin/enrollments/${id}`, "根拠を再確認済みにしました"));
}

/* ───────── 出勤（運営者・お店の共用） ───────── */

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** 出勤を編集してよいか。運営者は全件、お店は自店の在籍のみ */
async function authorizeEnrollment(enrollmentId: number) {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  const [e] = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1);
  if (!e) return { error: "在籍が見つかりません" } as const;
  if (u.role === "admin") return { user: u, enrollment: e, back: `/admin/enrollments/${e.id}` } as const;
  if (u.role === "shop" && u.shopId === e.shopId) return { user: u, enrollment: e, back: `/shop/enrollments/${e.id}` } as const;
  return { error: "この在籍の出勤を編集する権限がありません" } as const;
}

export async function saveSchedules(_p: FormState, fd: FormData): Promise<FormState> {
  const auth = await authorizeEnrollment(idOf(fd, "enrollmentId"));
  if ("error" in auth) return { error: auth.error };
  const from = String(fd.get("from") ?? "");
  const days = Number(fd.get("days") ?? 14);
  if (!isYmd(from) || !Number.isInteger(days) || days < 1 || days > 31) return { error: "表示期間が正しくありません。画面を開き直してください" };

  const origin = auth.user.role === "admin" ? "manual" : "shop";
  const ops: Array<(t: Tx) => Promise<unknown>> = [];
  for (const d of dateRange(from, days)) {
    const status = String(fd.get(`status_${d}`) ?? "");
    const start = String(fd.get(`start_${d}`) ?? "");
    const end = String(fd.get(`end_${d}`) ?? "");
    if (status === "") {
      ops.push((t) => t.delete(schedules).where(and(eq(schedules.enrollmentId, auth.enrollment.id), eq(schedules.workDate, d))));
      continue;
    }
    if (status !== "working" && status !== "off") return { error: `${d} の状態が正しくありません` };
    if (status === "working" && ((start && !timeRe.test(start)) || (end && !timeRe.test(end)))) return { error: `${d} の時刻は「20:00」の形で入力してください` };
    if (status === "working" && Boolean(start) !== Boolean(end)) return { error: `${d} は開始と終了の時刻を両方入力するか、両方空欄にしてください` };
    const values = {
      enrollmentId: auth.enrollment.id,
      workDate: d,
      status: status as "working" | "off",
      startTime: status === "working" && start ? start : null,
      endTime: status === "working" && end ? end : null,
      origin: origin as "manual" | "shop",
    };
    ops.push((t) =>
      t
        .insert(schedules)
        .values(values)
        .onConflictDoUpdate({
          target: [schedules.enrollmentId, schedules.workDate],
          set: { status: values.status, startTime: values.startTime, endTime: values.endTime, origin: values.origin, updatedAt: new Date() },
        }),
    );
  }
  await db.transaction(async (t) => {
    for (const op of ops) await op(t);
  });
  await audit(auth.user.id, "schedule.save", `enrollment:${auth.enrollment.id}`, `${from}+${days}d`);
  redirect(msg(`${auth.back}?from=${from}`, "出勤を保存しました"));
}

/** 表示中の期間に、直前7日の出勤パターンをそのまま写す（未入力の日だけ） */
export async function copyPreviousWeek(fd: FormData): Promise<void> {
  const auth = await authorizeEnrollment(idOf(fd, "enrollmentId"));
  if ("error" in auth) redirect("/login?error=forbidden");
  const from = String(fd.get("from") ?? "");
  const target = isYmd(from) ? from : todayJst();
  const prev = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.enrollmentId, auth.enrollment.id), gte(schedules.workDate, addDays(target, -7)), lte(schedules.workDate, addDays(target, -1))));
  const origin = auth.user.role === "admin" ? "manual" : "shop";
  let copied = 0;
  for (const p of prev) {
    const d = addDays(p.workDate, 7);
    const res = await db
      .insert(schedules)
      .values({ enrollmentId: auth.enrollment.id, workDate: d, status: p.status, startTime: p.startTime, endTime: p.endTime, origin })
      .onConflictDoNothing()
      .returning({ id: schedules.id });
    copied += res.length;
  }
  await audit(auth.user.id, "schedule.copy_week", `enrollment:${auth.enrollment.id}`, `${target} copied=${copied}`);
  redirect(msg(`${auth.back}?from=${target}`, copied ? `先週の出勤を${copied}日分写しました（入力済みの日はそのままです）` : "写せる先週の出勤がありませんでした"));
}

/* ───────── お店：名前非公開の在籍数 ───────── */

export async function updateOwnAnonymousCount(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireShop();
  const r = z
    .object({
      anonymousAvCount: z.coerce.number().int().min(0, "人数は0以上で入力してください").max(999),
      anonymousAvSourceUrl: optionalHttpUrl("根拠のURL"),
    })
    .safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: firstIssue(r.error) };
  if (r.data.anonymousAvCount > 0 && !r.data.anonymousAvSourceUrl) return { error: "人数を入れる場合は、公表しているページのURLも入力してください" };
  await db.update(shops).set({ ...r.data, updatedAt: new Date() }).where(eq(shops.id, u.shopId));
  await audit(u.id, "shop.anonymous_count", `shop:${u.shopId}`, String(r.data.anonymousAvCount));
  redirect(msg("/shop", "名前非公開の在籍数を保存しました"));
}

/* ───────── 取り込み元 ───────── */

const sourceSchema = z.object({
  name: z.string().trim().min(1, "名称を入力してください").max(100),
  kind: z.enum(["json_feed", "avzoku", "cityheaven", "avfuzoku"]),
  url: httpUrl("取り込み元のURL"),
  shopId: z.string().optional(),
  maxPages: z.coerce.number().int().min(1, "巡回ページ数は1以上にしてください").max(14, "巡回ページ数は14以下にしてください"),
});

function sourceValues(fd: FormData) {
  const r = sourceSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: firstIssue(r.error) } as const;
  const enabled = bool(fd, "enabled");
  const termsConfirmed = bool(fd, "termsConfirmed");
  const shopId = Number(r.data.shopId);
  const hasShop = Number.isInteger(shopId) && shopId > 0;
  if (r.data.kind === "json_feed" && !hasShop) return { error: "JSONフィードは対象の店舗を選んでください" } as const;
  if (r.data.kind === "avfuzoku" && !/^https:\/\/www\.avfuzoku-soap-deli\.com\/sitemap\.html$/.test(r.data.url)) return { error: "avfuzoku は全記事リストのURL「https://www.avfuzoku-soap-deli.com/sitemap.html」を入力してください" } as const;
  if (r.data.kind === "avzoku" && !/^https:\/\/avzoku\.com\/schedule\//.test(r.data.url)) return { error: "avzoku は「https://avzoku.com/schedule/〜」の出勤一覧ページのURLを入力してください" } as const;
  if (r.data.kind === "cityheaven" && !/^https:\/\/www\.cityheaven\.net\//.test(r.data.url)) return { error: "シティヘブンは「https://www.cityheaven.net/〜」のURLを入力してください（地域を限定する場合は /tokyo/ などを含めてください）" } as const;
  if (enabled && !termsConfirmed) return { error: "有効にするには、取り込み元の規約で自動取得が許されていることを確認し「規約確認済み」にチェックしてください" } as const;
  return { data: { name: r.data.name, kind: r.data.kind, url: r.data.url, maxPages: r.data.maxPages, shopId: r.data.kind === "json_feed" ? shopId : null, enabled, termsConfirmed } } as const;
}

export async function createSource(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const v = sourceValues(fd);
  if ("error" in v) return { error: v.error };
  const [row] = await db.insert(dataSources).values(v.data).returning({ id: dataSources.id });
  await audit(u.id, "source.create", `source:${row.id}`, v.data.url);
  redirect(msg(`/admin/sources/${row.id}`, "取り込み元を登録しました"));
}

export async function updateSource(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const id = idOf(fd);
  const v = sourceValues(fd);
  if ("error" in v) return { error: v.error };
  await db.update(dataSources).set(v.data).where(eq(dataSources.id, id));
  await audit(u.id, "source.update", `source:${id}`);
  redirect(msg(`/admin/sources/${id}`, "取り込み元を保存しました"));
}

export async function deleteSource(fd: FormData): Promise<void> {
  const u = await requireAdmin();
  const id = idOf(fd);
  await db.delete(dataSources).where(eq(dataSources.id, id));
  await audit(u.id, "source.delete", `source:${id}`);
  redirect(msg("/admin/sources", "取り込み元を削除しました"));
}

export async function runSourceNow(fd: FormData): Promise<void> {
  const u = await requireAdmin();
  const id = idOf(fd);
  const [s] = await db.select().from(dataSources).where(eq(dataSources.id, id));
  if (!s) redirect("/admin/sources");
  // まとめサイト型は待ち行列で処理する。この場で約3分処理し、残りは10分ごとの自動実行が続きから処理する
  if (isQueuedKind(s.kind)) {
    // 自動実行が動いている最中は重ねて走らせない
    if (!(await acquireLease("ingest", 310_000))) {
      redirect(msg(`/admin/sources/${id}`, "いま自動の取り込みが実行中です。数分おいてから、もう一度お試しください。"));
    }
    try {
    const q = await enqueueSource(s, { force: true });
    if (q.error) {
      await audit(u.id, "source.run", `source:${id}`, `error=${q.error}`);
      redirect(msg(`/admin/sources/${id}`, `取り込みに失敗しました：${q.error}`));
    }
    const d = await drainQueue(Date.now() + 180_000);
    await audit(u.id, "source.run", `source:${id}`, `queued=${q.queued} processed=${d.processed} remaining=${d.remaining}`);
    redirect(
      msg(
        `/admin/sources/${id}`,
        `${q.queued}人分の取り込みを始め、${d.processed}人分を処理しました（出勤${d.applied}件を反映）。` +
          (d.remaining ? `残り${d.remaining}人分は、10分ごとの自動実行で続きから処理されます。` : "すべて完了しました。"),
      ),
    );
    } finally {
      await releaseLease("ingest");
    }
  }
  const r = await runSource(s);
  await audit(u.id, "source.run", `source:${id}`, r.ok ? `applied=${r.applied}` : `error=${r.error}`);
  redirect(
    msg(
      `/admin/sources/${id}`,
      r.ok ? `取り込みが完了しました：${r.applied}件を反映${r.unmatched.length ? `、未照合${r.unmatched.length}件` : ""}` : `取り込みに失敗しました：${r.error}`,
    ),
  );
}

/* ───────── 削除依頼 ───────── */

export async function updateRemoval(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const id = idOf(fd);
  const r = z
    .object({ status: z.enum(["new", "in_progress", "done", "rejected"]), adminNote: z.string().trim().max(2000) })
    .safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: firstIssue(r.error) };
  await db.update(removalRequests).set({ ...r.data, updatedAt: new Date() }).where(eq(removalRequests.id, id));
  await audit(u.id, "removal.update", `removal:${id}`, r.data.status);
  redirect(msg(`/admin/removals/${id}`, "対応状況を保存しました"));
}

/* ───────── アカウント ───────── */

const password = z.string().min(10, "パスワードは10文字以上にしてください").max(200);

export async function createUser(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const r = z
    .object({
      email: z.string().trim().toLowerCase().email("メールアドレスの形式が正しくありません"),
      displayName: z.string().trim().max(60),
      role: z.enum(["admin", "shop"]),
      shopId: z.string().optional(),
      password,
    })
    .safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: firstIssue(r.error) };
  const shopId = Number(r.data.shopId);
  if (r.data.role === "shop" && !(Number.isInteger(shopId) && shopId > 0)) return { error: "お店アカウントには所属店舗を選んでください" };
  try {
    const [row] = await db
      .insert(users)
      .values({
        email: r.data.email,
        displayName: r.data.displayName,
        role: r.data.role,
        shopId: r.data.role === "shop" ? shopId : null,
        passwordHash: await hashPassword(r.data.password),
      })
      .returning({ id: users.id });
    await audit(u.id, "user.create", `user:${row.id}`, r.data.role);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "このメールアドレスはすでに登録されています" };
    throw e;
  }
  redirect(msg("/admin/users", "アカウントを作成しました"));
}

export async function resetPassword(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const id = idOf(fd);
  const r = password.safeParse(fd.get("password"));
  if (!r.success) return { error: firstIssue(r.error) };
  await db.update(users).set({ passwordHash: await hashPassword(r.data) }).where(eq(users.id, id));
  await audit(u.id, "user.reset_password", `user:${id}`);
  redirect(msg(`/admin/users/${id}`, "パスワードを再設定しました"));
}

export async function deleteUser(fd: FormData): Promise<void> {
  const u = await requireAdmin();
  const id = idOf(fd);
  if (id === u.id) redirect(msg(`/admin/users/${id}`, "自分自身のアカウントは削除できません"));
  const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), ne(users.id, id)));
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (target?.role === "admin" && admins.length === 0) redirect(msg(`/admin/users/${id}`, "運営者アカウントが1つもなくなるため削除できません"));
  await db.delete(users).where(eq(users.id, id));
  await audit(u.id, "user.delete", `user:${id}`);
  redirect(msg("/admin/users", "アカウントを削除しました"));
}

/* ───────── 確認待ちの女の子（シティヘブン取り込み） ───────── */

/** 掲載ページを確認したうえで、指定の女優として結び付ける */
export async function linkCandidateAction(_p: FormState, fd: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const id = idOf(fd, "candidateId");
  const actressId = Number(fd.get("actressId"));
  if (!Number.isInteger(actressId) || actressId <= 0) return { error: "結び付ける女優を選んでください" };
  const confirmed = bool(fd, "confirmed");
  if (!confirmed) return { error: "掲載ページを開いて本人であることを確認し、チェックを入れてください" };
  try {
    await linkCandidate(id, actressId, u.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "結び付けに失敗しました" };
  }
  await audit(u.id, "candidate.link", `candidate:${id}`, `actress:${actressId}`);
  redirect(msg("/admin/candidates", "女優と結び付けました"));
}

/** 対象外にする（次回以降の取り込みで並べ直さない） */
export async function ignoreCandidateAction(fd: FormData): Promise<void> {
  const u = await requireAdmin();
  const id = idOf(fd, "candidateId");
  await ignoreCandidates([id], u.id);
  await audit(u.id, "candidate.ignore", `candidate:${id}`);
  redirect(msg("/admin/candidates", "対象外にしました"));
}

// ---- DMM から女優の写真・女優IDを一括で取り込む ----
// 名前が完全一致で1人に定まった女優だけを更新する。複数候補・該当なしは触らず件数だけ知らせる
const DMM_BATCH = 40; // 1回の実行で問い合わせる人数（APIへの負担と実行時間を抑える）
const normName = (s: string) => s.replace(/[\s　]/g, "");

export async function fillDmmImages(): Promise<void> {
  const u = await requireAdmin();
  if (!dmmConfigured()) redirect(msg("/admin/actresses", "DMMのAPIキーが未設定のため実行できません。環境変数を設定してください。"));
  const targets = await db
    .select({ id: actresses.id, name: actresses.name, imageUrl: actresses.imageUrl })
    .from(actresses)
    .where(isNull(actresses.dmmActressId))
    .orderBy(asc(actresses.id))
    .limit(DMM_BATCH);

  let updated = 0, ambiguous = 0, notFound = 0, failed = 0;
  for (const t of targets) {
    const r = await searchDmmActress(t.name);
    if (!r.ok) { failed++; continue; }
    const exact = r.items.filter((i) => normName(i.name) === normName(t.name));
    if (exact.length === 1) {
      const hit = exact[0];
      await db
        .update(actresses)
        .set({ dmmActressId: hit.id, imageUrl: t.imageUrl || hit.imageUrl })
        .where(eq(actresses.id, t.id));
      updated++;
    } else if (exact.length > 1) ambiguous++;
    else notFound++;
    await new Promise((res) => setTimeout(res, 1100)); // 1秒に1件程度に抑える
  }
  await audit(u.id, "actress.dmm_fill", "actresses", `updated=${updated} ambiguous=${ambiguous} notFound=${notFound} failed=${failed}`);
  const rest = targets.length === DMM_BATCH ? "（未処理の女優が残っている場合は、もう一度実行してください）" : "";
  redirect(
    msg(
      "/admin/actresses",
      `DMMから${updated}人の写真とIDを取り込みました。同名の候補が複数：${ambiguous}人、見つからず：${notFound}人、通信失敗：${failed}人。${rest}`,
    ),
  );
}

/** 許可済みの取り込み元をまとめて登録する。登録済みのURLはページ数だけ推奨値に合わせ、有効・停止の状態は変えない */
export async function registerRecommendedSources(): Promise<void> {
  const u = await requireAdmin();
  const existing = await db.select().from(dataSources);
  let created = 0;
  let updated = 0;
  for (const r of RECOMMENDED_SOURCES) {
    const hit = existing.find((e) => e.url === r.url);
    if (hit) {
      if (hit.maxPages !== r.maxPages) {
        await db.update(dataSources).set({ maxPages: r.maxPages }).where(eq(dataSources.id, hit.id));
        updated++;
      }
      continue;
    }
    await db.insert(dataSources).values({ name: r.name, kind: r.kind, url: r.url, maxPages: r.maxPages, enabled: true, termsConfirmed: true });
    created++;
  }
  await audit(u.id, "source.register_recommended", "data_sources", `created=${created} updated=${updated}`);
  redirect(
    msg(
      "/admin/sources",
      created || updated
        ? `取り込み元を${created}件登録し、${updated}件のページ数を見直しました。10分以内に自動で取り込みが始まります。`
        : "おすすめの取り込み元は、すべて登録済みです。",
    ),
  );
}
