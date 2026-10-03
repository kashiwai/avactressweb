// ログインとセッション管理（サーバー専用）
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, auditLogs, type User } from "@/db/schema";

export const SESSION_COOKIE = "sid";
const SESSION_DAYS = 7;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

/** ログイン成功時に呼ぶ。毎回新しいトークンを発行する（セッション固定化の防止） */
export async function createSession(userId: number): Promise<void> {
  const store = await cookies();
  const old = store.get(SESSION_COOKIE)?.value;
  if (old) await db.delete(sessions).where(eq(sessions.id, hashToken(old)));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

export type SessionUser = Pick<User, "id" | "email" | "role" | "shopId" | "displayName">;

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      shopId: users.shopId,
      displayName: users.displayName,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.role !== "admin") redirect("/login?error=forbidden");
  return u;
}

/** お店アカウント。自店のIDを必ず持つ */
export async function requireShop(): Promise<SessionUser & { shopId: number }> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.role !== "shop" || u.shopId == null) redirect("/login?error=forbidden");
  return u as SessionUser & { shopId: number };
}

export async function audit(userId: number | null, action: string, target: string, detail = ""): Promise<void> {
  await db.insert(auditLogs).values({ userId, action, target, detail });
}
