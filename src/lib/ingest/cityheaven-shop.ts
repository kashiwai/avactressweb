// シティヘブンの店舗「出勤情報（週間スケジュール）」読み取り。通信は行わない純粋関数のみ
// 店ページに、源氏名・日付・開始〜終了が表で載っている。源氏名で照合して出勤を反映する。
import { htmlText, stripChrome } from "./html";
import { normalizePersonName } from "./normalize";
import { inferYmd } from "./avzoku";

export type ShopShiftDay = {
  date: string; // YYYY-MM-DD
  status: "working" | "off";
  start: string | null; // HH:MM
  end: string | null;
};

export type ShopShiftGirl = {
  displayName: string;
  girlUrl: string;
  days: ShopShiftDay[];
};

const timeRe = /(\d{1,2}):(\d{2})/;
const pad = (n: string) => String(Number(n)).padStart(2, "0");
const normTime = (h: string, m: string) => `${pad(String(Number(h) % 24))}:${m}`;

/** 「15:00 - 3:00」「受付終了 13:30 - 0:00」から開始・終了を読む */
export function parseShiftTimes(text: string): { start: string; end: string } | null {
  const times = [...text.matchAll(/(\d{1,2}):(\d{2})/g)];
  if (times.length < 2) return null;
  return { start: normTime(times[0][1], times[0][2]), end: normTime(times[1][1], times[1][2]) };
}

/** 週間スケジュール1ページ分を読む */
export function parseCityheavenWeekly(html: string, pageUrl: string, today: string): ShopShiftGirl[] {
  const body = stripChrome(html);
  if (!body.includes('id="shukkin_list"')) return [];
  // 女の子ごとに小さな表が並ぶため、ページ全体の tr を順に読む
  const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  const out = new Map<string, ShopShiftGirl>();
  let currentName = "";
  let currentUrl = "";
  let dates: string[] = [];

  for (const row of rows) {
    if (/class="topbox"/.test(row)) {
      const nameHtml = row.match(/<th[^>]*class="topbox"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!nameHtml) continue;
      currentUrl = new URL(nameHtml[1], pageUrl).toString();
      currentName = htmlText(nameHtml[2]);
      dates = [...row.matchAll(/<th[^>]*class="week"[^>]*>([\s\S]*?)<\/th>/g)]
        .map((m) => htmlText(m[1]).match(/(\d{1,2}\/\d{1,2})/)?.[1] ?? "")
        .map((d) => (d ? inferYmd(d, today) : null))
        .filter((d): d is string => Boolean(d));
      continue;
    }
    if (!currentName || dates.length === 0) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < dates.length) continue;
    // 先頭のセルは写真。写真セルが無い店もあるため、日付数に合わせて読む
    const shiftCells = cells.length >= dates.length + 1 ? cells.slice(1, 1 + dates.length) : cells.slice(0, dates.length);
    const days: ShopShiftDay[] = dates.map((date, i) => {
      const cell = shiftCells[i] ?? "";
      const times = parseShiftTimes(htmlText(cell));
      if (times) return { date, status: "working", start: times.start, end: times.end };
      return { date, status: "off", start: null, end: null };
    });
    const key = normalizePersonName(currentName);
    if (!out.has(key)) out.set(key, { displayName: currentName, girlUrl: currentUrl, days });
  }
  return [...out.values()];
}

/** ページ送り（attend/weekly/2/ など）のURLを集める */
export function parseCityheavenWeeklyPages(html: string, pageUrl: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href="([^"]*\/attend\/weekly\/\d+\/)"[^>]*>/g)) {
    urls.add(new URL(m[1], pageUrl).toString());
  }
  return [...urls];
}

/** シティヘブンの店舗URLに正規化する（女の子ページ・出勤ページでも店のURLに戻す） */
export function cityheavenShopUrl(url: string): string {
  let u = url.split("?")[0].replace(/\/+$/, "");
  u = u.replace(/\/girlid-\d+$/, "");
  u = u.replace(/\/attend(\/weekly\/\d+)?$/, "");
  return u;
}

/** 店舗の出勤情報ページ（/attend/）のURLを作る */
export function cityheavenAttendUrl(officialUrl: string): string {
  return `${cityheavenShopUrl(officialUrl)}/attend/`;
}
