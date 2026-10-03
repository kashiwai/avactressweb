// 毎日の取り込みの口（Vercel Cron などから Authorization: Bearer <CRON_SECRET> 付きで呼ぶ）
import { timingSafeEqual } from "node:crypto";
import { runAllSources } from "@/lib/ingest/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const results = await runAllSources();
  return Response.json({ ok: true, count: results.length, results });
}
