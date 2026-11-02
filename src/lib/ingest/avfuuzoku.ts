// avfuuzoku.com（AV女優風俗在籍情報更新.com。運営者の許可を得た取り込み元）のページ読み取り。通信は行わない純粋関数のみ
// ジャンル一覧（genre_search.php）に全女優の詳細ページがあり、詳細ページに
// 「源氏名 / AV女優名 / 在籍店舗名 / ジャンル / エリア / 電話番号」が載っている。
import { prefCodeOfArea } from "./avfuzoku";
import { cleanDisplayName, normalizePhone, nfkc } from "./normalize";
import { decodeHtml, htmlText, stripChrome, firstDmmImage } from "./html";
import type { ScrapedEntry } from "./types";

export const AVFUZOKU_ORIGIN = "https://avfuuzoku.com";

/** 詳細ページ（detail.php?id=...）のURLを集める */
export function parseAvfuuzokuIndex(html: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(/href="(?:\.\/|\/|https:\/\/avfuuzoku\.com\/)detail\.php\?id=(\d+)"/g)) {
    urls.add(`${AVFUZOKU_ORIGIN}/detail.php?id=${m[1]}`);
  }
  return [...urls];
}

function rowValue(body: string, label: string): string {
  const m = body.match(new RegExp(`<th[^>]*>\\s*${label}\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`));
  return m ? m[1] : "";
}

/** 詳細ページ1件を在籍として読む */
export function parseAvfuuzokuDetail(html: string, url: string): ScrapedEntry | null {
  const body = stripChrome(html);
  const table = body.match(/<table class="right">([\s\S]*?)<\/table>/)?.[0] ?? body;
  const name = htmlText(rowValue(table, "AV女優名"));
  const displayRaw = htmlText(rowValue(table, "源氏名"));
  const shopRaw = htmlText(rowValue(table, "在籍店舗名"));
  if (!name || !shopRaw) return null;

  const closed = /\[(?:退店|閉店)\]|（閉店）|\(閉店\)/.test(displayRaw + shopRaw);
  const shopName = nfkc(shopRaw.replace(/\[(?:退店|閉店)\]/g, "")).replace(/[（(]閉店[)）]/g, "").trim();
  const genre = htmlText(rowValue(table, "ジャンル"));
  const area = htmlText(rowValue(table, "エリア"));
  const phone = htmlText(rowValue(table, "電話番号"));
  const shopUrl = rowValue(table, "在籍店舗名").match(/href="([^"]+)"/)?.[1] ?? "";

  return {
    actressName: name,
    displayName: cleanDisplayName(displayRaw) || name,
    shopName,
    area,
    genre,
    prefCode: prefCodeOfArea(area) ?? prefCodeOfArea(shopName),
    phone: normalizePhone(phone) || undefined,
    shopUrl: decodeHtml(shopUrl),
    sourceUrl: url,
    // 女優写真が無いページなので、作品画像を表示用の最後の手段にする
    actressImageUrl: firstDmmImage(body, url) || undefined,
    status: closed ? "left" : "active",
  };
}
