// 開発時だけ使える取り込みテスト用のJSONフィード（本番では404）
import { addDays, todayJst } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not Found", { status: 404 });
  const t = todayJst();
  return Response.json({
    schedules: [
      { cast_name: "星宮みれい（見本）", date: addDays(t, 20), start: "19:00", end: "03:00", status: "working" },
      { cast_name: "星宮みれい（見本）", date: addDays(t, 21), status: "off" },
      { cast_name: "未登録の名前", date: addDays(t, 20), start: "12:00", end: "18:00", status: "working" },
    ],
  });
}
