// 取り込みアダプタ。取り込み元の形式ごとに「出勤の一覧」へ変換する
import { z } from "zod";
import { isYmd } from "../dates";
import { USER_AGENT } from "./robots";

export type FeedSchedule = {
  castName: string;
  date: string; // YYYY-MM-DD
  start: string | null; // HH:MM
  end: string | null;
  status: "working" | "off";
};

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const feedSchema = z.object({
  schedules: z.array(
    z.object({
      cast_name: z.string().trim().min(1),
      date: z.string().refine(isYmd, "date は YYYY-MM-DD 形式"),
      start: z.string().regex(timeRe).nullish(),
      end: z.string().regex(timeRe).nullish(),
      status: z.enum(["working", "off"]),
    }),
  ),
});

/** JSONフィードの中身を検証して変換する（取得とは分けてテストできるようにしている） */
export function parseJsonFeed(body: unknown): FeedSchedule[] {
  const parsed = feedSchema.parse(body);
  return parsed.schedules.map((s) => ({
    castName: s.cast_name,
    date: s.date,
    start: s.status === "working" ? (s.start ?? null) : null,
    end: s.status === "working" ? (s.end ?? null) : null,
    status: s.status,
  }));
}

export type Adapter = (url: string) => Promise<FeedSchedule[]>;

export const adapters: Record<"json_feed", Adapter> = {
  async json_feed(url) {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`取得に失敗しました（HTTP ${res.status}）`);
    const text = await res.text();
    if (text.length > 2_000_000) throw new Error("データが大きすぎます（2MB超）");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("JSONとして読み取れませんでした");
    }
    try {
      return parseJsonFeed(json);
    } catch (e) {
      if (e instanceof z.ZodError) throw new Error(`データの形式が違います: ${e.issues[0]?.path.join(".")} ${e.issues[0]?.message}`);
      throw e;
    }
  },
};
