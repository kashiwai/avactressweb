"use server";
// 公開側の書き込み処理（年齢確認・削除依頼・ログイン）
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { removalRequests, users } from "@/db/schema";
import { audit, createSession, destroySession, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

function safeNext(n: FormDataEntryValue | null): string {
  const s = typeof n === "string" ? n : "/";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function confirmAge(formData: FormData) {
  const store = await cookies();
  store.set("age_ok", "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(safeNext(formData.get("next")));
}

const removalSchema = z.object({
  requesterType: z.enum(["actress", "agency", "shop", "other"], { message: "ご依頼者の区分を選んでください" }),
  requesterName: z.string().trim().min(1, "お名前を入力してください").max(100),
  contact: z.string().trim().min(3, "連絡先を入力してください").max(200),
  targetActressId: z.string().optional(),
  targetText: z.string().trim().min(1, "対象のページや女優名を入力してください").max(500),
  reason: z.string().trim().min(1, "ご依頼の理由を入力してください").max(2000),
});

// 同じ接続元からの連続送信を抑える（簡易・プロセス内）
const recent = new Map<string, number>();

export async function submitRemoval(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = removalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  if (formData.get("website")) return { error: "送信できませんでした。時間をおいてもう一度お試しください。" };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const last = recent.get(ip) ?? 0;
  if (Date.now() - last < 30_000) return { error: "続けて送信されました。30秒ほど時間をおいてから、もう一度お試しください。" };
  recent.set(ip, Date.now());

  const tid = Number(parsed.data.targetActressId);
  await db.insert(removalRequests).values({
    requesterType: parsed.data.requesterType,
    requesterName: parsed.data.requesterName,
    contact: parsed.data.contact,
    targetActressId: Number.isInteger(tid) && tid > 0 ? tid : null,
    targetText: parsed.data.targetText,
    reason: parsed.data.reason,
  });
  redirect("/removal/done");
}

const loginSchema = z.object({
  email: z.string().trim().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(1, "パスワードを入力してください"),
});

const failures = new Map<string, { n: number; until: number }>();

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const email = parsed.data.email.toLowerCase();

  const f = failures.get(email);
  if (f && f.until > Date.now()) return { error: "ログインの失敗が続いたため、一時的にロックしています。15分ほど待ってからお試しください。" };

  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const ok = u ? await verifyPassword(parsed.data.password, u.passwordHash) : false;
  if (!u || !ok) {
    const n = (f?.n ?? 0) + 1;
    failures.set(email, { n, until: n >= 5 ? Date.now() + 15 * 60_000 : 0 });
    return { error: "メールアドレスかパスワードが違います。" };
  }
  failures.delete(email);
  await createSession(u.id);
  await audit(u.id, "login", `user:${u.id}`);
  redirect(u.role === "admin" ? "/admin" : "/shop");
}

export async function logout() {
  await destroySession();
  redirect("/login?msg=" + encodeURIComponent("ログアウトしました"));
}
