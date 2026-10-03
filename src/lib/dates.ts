// 日付はすべて日本時間（JST）で扱う。DBには 'YYYY-MM-DD' の文字列で持つ

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 日本時間の今日を 'YYYY-MM-DD' で返す */
export function todayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 日本時間の現在時刻を 'HH:MM' で返す */
export function nowTimeJst(now: Date = new Date()): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(11, 16);
}

/** 'YYYY-MM-DD' に日数を足す */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** from から n 日分の日付の配列 */
export function dateRange(from: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(from, i));
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function weekdayIndex(ymd: string): number {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay();
}

export function weekdayLabel(ymd: string): string {
  return WEEKDAYS[weekdayIndex(ymd)];
}

export const WEEKDAY_LABELS = WEEKDAYS;

/** 9/28(日) 形式 */
export function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}(${weekdayLabel(ymd)})`;
}

/** 'HH:MM:SS' → 'HH:MM' */
export function hm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}

/**
 * 出勤時間帯の中にいるか。終了が開始より前（例 20:00〜05:00）の場合は日をまたぐものとして扱う
 */
export function isWithinShift(start: string | null, end: string | null, nowHm: string): boolean {
  if (!start || !end) return false;
  const s = hm(start);
  const e = hm(end);
  if (s <= e) return nowHm >= s && nowHm < e;
  return nowHm >= s || nowHm < e;
}

export function formatDateTimeJst(d: Date | null | undefined): string {
  if (!d) return "—";
  const j = new Date(d.getTime() + JST_OFFSET_MS).toISOString();
  return `${j.slice(0, 10).replace(/-/g, "/")} ${j.slice(11, 16)}`;
}

export function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
}
