// avzoku.com（運営者の許可を得た取り込み元）のページ読み取り。通信は行わない純粋関数のみ
import { PREFECTURES } from "../prefectures";
import { GENRES } from "../genres";
import { imageByAlt, ogImage } from "./html";

const decode = (s: string) =>
  s
    .replace(/&#0?38;|&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const text = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

export type AvzokuListPage = { actressUrls: string[]; nextUrl: string | null };

/** 地域別の出勤一覧ページ：女優ページのURLと「次の日」のURLを取り出す */
export function parseAvzokuList(html: string): AvzokuListPage {
  const urls = new Set<string>();
  const re = /<div class="sokuhime">\s*<a href="(https:\/\/avzoku\.com\/[^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) urls.add(m[1]);
  const next = html.match(/<a href="(https:\/\/avzoku\.com\/schedule\/[^"]+)">\s*<div class="schedule-pagination-next">/);
  return { actressUrls: [...urls], nextUrl: next ? decode(next[1]) : null };
}

export type AvzokuActress = {
  url: string;
  name: string;
  kana: string;
  imageUrl: string;
  prefCode: number | null;
  area: string;
  genre: string; // GENRES の名前に正規化済み
  shopName: string;
  shopUrl: string;
  displayName: string;
  verifiedAt: string | null; // YYYY-MM-DD
  schedules: Array<{ date: string; start: string | null; end: string | null }>; // start が null の日は予定なし
};

function tableValue(html: string, label: string): string {
  const m = html.match(new RegExp(`<th>${label}</th>\\s*<td>([\\s\\S]*?)</td>`));
  return m ? m[1] : "";
}

export function normalizeGenre(raw: string): string {
  const r = raw.replace(/\s/g, "");
  if (/チャイデリ|チャイナデリ|チャイニーズデリ|中国デリ/.test(r)) return "チャイデリ";
  if (/ホテヘル|ホテルヘルス/.test(r)) return "ホテヘル";
  if (/デリヘル|デリバリー/.test(r)) return "デリヘル";
  if (/ソープ/.test(r)) return "ソープ";
  if (/エステ/.test(r)) return "風俗エステ";
  if (/ピンサロ/.test(r)) return "ピンサロ";
  if (/SM/i.test(r)) return "SM";
  if (/ヘルス/.test(r)) return "店舗型ヘルス";
  return GENRES.find((g) => g.name === r)?.name ?? "その他";
}

/** 月日だけの表記（09/27）に年を補う。今日から見て半年以上前なら翌年とみなす */
export function inferYmd(mmdd: string, today: string): string | null {
  const m = mmdd.match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const [ty, tm] = today.split("-").map(Number);
  const mo = Number(m[1]);
  let y = ty;
  if (mo < tm - 6) y = ty + 1;
  if (mo > tm + 6) y = ty - 1;
  return `${y}-${String(mo).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

/** 女優ページ：プロフィール表・店舗表・出勤予定を読み取る。店名が無いページは null */
export function parseAvzokuActress(html: string, url: string, today: string): AvzokuActress | null {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
  const name = text(tableValue(body, "名前"));
  const shopCell = tableValue(body, "店名");
  if (!name || !shopCell) return null;
  const shopLink = shopCell.match(/href="([^"]+)"/);
  const prefName = text(tableValue(body, "都道府県"));
  const verified = text(tableValue(body, "在籍確認")).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);

  const schedules: AvzokuActress["schedules"] = [];
  const secStart = body.indexOf("の風俗出勤情報", Math.max(0, body.indexOf("<article")));
  if (secStart >= 0) {
    const sec = text(body.slice(secStart, secStart + 6000));
    const re = /(\d{2}\/\d{2})\([日月火水木金土]\)\s*(?:(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2}))?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sec))) {
      const date = inferYmd(m[1], today);
      if (!date || schedules.some((s) => s.date === date)) continue;
      const fix = (t?: string) => (t ? (t.length === 4 ? `0${t}` : t) : null);
      // 24:00 表記は 00:00 に直す
      const norm = (t: string | null) => (t && Number(t.slice(0, 2)) >= 24 ? `${String(Number(t.slice(0, 2)) - 24).padStart(2, "0")}${t.slice(2)}` : t);
      schedules.push({ date, start: norm(fix(m[2])), end: norm(fix(m[3])) });
    }
  }

  return {
    url,
    name,
    kana: text(tableValue(body, "よみ")),
    imageUrl: imageByAlt(body, url, name) || ogImage(body, url),
    prefCode: PREFECTURES.find((p) => p.name === prefName)?.code ?? null,
    area: text(tableValue(body, "エリア")),
    genre: normalizeGenre(text(tableValue(body, "ジャンル"))),
    shopName: text(shopCell),
    shopUrl: shopLink ? decode(shopLink[1]) : "",
    displayName: text(tableValue(body, "源氏名")).replace(/\s*\(\d+\)\s*$/, "") || name,
    verifiedAt: verified ? `${verified[1]}-${verified[2].padStart(2, "0")}-${verified[3].padStart(2, "0")}` : null,
    schedules,
  };
}
