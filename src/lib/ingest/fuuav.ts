// fuuav.com（運営者の許可を得た取り込み元）のページ読み取り。通信は行わない純粋関数のみ
// 女優ページに「在籍店一覧」（店名（地域・業種）＋源氏名）と「退店一覧」が載っている。
import { prefCodeOfArea } from "./avfuzoku";
import { cleanDisplayName, nfkc, splitAreaGenre } from "./normalize";
import { decodeHtml, htmlText, stripChrome, ogImage } from "./html";
import type { ScrapedActressPage, ScrapedEntry } from "./types";

export const FUUAV_ORIGIN = "https://fuuav.com";

export type FuuavIndexPage = { actressUrls: string[]; nextUrl: string | null };

/** 全記事一覧（/allposts/）から女優ページと次のページを読む */
export function parseFuuavIndex(html: string): FuuavIndexPage {
  const urls = new Set<string>();
  // 記事カードは画像→見出しの順で、見出しがリンクの数百文字後ろにあるため、リンク全体の中を見る
  for (const m of html.matchAll(/<a[^>]+href="(https:\/\/fuuav\.com\/([a-z0-9_-]+)\/)"[^>]*>([\s\S]{0,3000}?)<\/a>/g)) {
    if (/風俗店在籍・退店まとめ/.test(m[3])) urls.add(m[1]);
  }
  const next =
    html.match(/<a[^>]+href="(https:\/\/fuuav\.com\/allposts\/page\/\d+\/)"[^>]*class="[^"]*-to-next/) ??
    html.match(/<a[^>]+class="[^"]*-to-next"[^>]+href="(https:\/\/fuuav\.com\/allposts\/page\/\d+\/)"/);
  return { actressUrls: [...urls], nextUrl: next ? decodeHtml(next[1]) : null };
}

function parseShopLabel(raw: string): { shopName: string; area: string; genre: string } {
  const s = nfkc(raw);
  const m = s.match(/[（(]([^（）()]*)[）)]\s*$/);
  if (m) {
    const parts = splitAreaGenre(m[1]);
    const shopName = s.slice(0, m.index).trim();
    if (shopName && (parts.genre || prefCodeOfArea(parts.area))) return { shopName, area: parts.area, genre: parts.genre };
  }
  return { shopName: s, area: "", genre: "" };
}

/** 表（源氏名）から店での名前を読む */
function displayNameOf(tableHtml: string): string {
  const row = tableHtml.match(/<tr>\s*<td>\s*源氏名\s*<\/td>\s*<td>([\s\S]*?)<\/td>/);
  return row ? cleanDisplayName(htmlText(row[1])) : "";
}

function toEntry(name: string, shopLabel: string, tableHtml: string, status: ScrapedEntry["status"], url: string): ScrapedEntry | null {
  const label = parseShopLabel(shopLabel);
  const displayName = displayNameOf(tableHtml);
  if (!label.shopName || !displayName) return null;
  return {
    actressName: name,
    displayName,
    shopName: label.shopName,
    area: label.area,
    genre: label.genre,
    prefCode: prefCodeOfArea(label.area) ?? prefCodeOfArea(label.shopName),
    sourceUrl: url,
    status,
  };
}

/** 女優ページ：在籍店一覧と退店一覧を読み取る */
export function parseFuuavActress(html: string, url: string): ScrapedActressPage | null {
  const body = stripChrome(html);
  const h1 = htmlText(body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? body.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "");
  const name = (h1.match(/[「『]([^」』]+)[」』]/)?.[1] ?? h1.replace(/\|.*$/, "")).trim();
  if (!name) return null;
  const imageUrl = ogImage(body, url);

  // 見出しは「（女優名）の在籍店一覧」。名前の空白差で取りこぼさないよう、見出しの語尾で探す
  const activeStart = body.search(/<h2[^>]*>[\s\S]{0,80}?の在籍店一覧/);
  if (activeStart < 0) return { name, imageUrl, entries: [] };
  const leftStart = body.search(/<h2[^>]*>[\s\S]{0,80}?の退店一覧/);
  const nextH2 = body.slice(activeStart + 10).search(/<h2[\s>]/);
  const activeEnd = leftStart > activeStart ? leftStart : nextH2 >= 0 ? activeStart + 10 + nextH2 : Math.min(body.length, activeStart + 20000);
  const active = body.slice(activeStart, activeEnd);
  const left = leftStart >= 0 ? body.slice(leftStart, leftStart + 30000) : "";

  const entries = new Map<string, ScrapedEntry>();
  for (const [section, status] of [[active, "active"], [left, "left"]] as const) {
    // 見出し（h3）またはアコーディオンの summary に「店名（地域・業種）」、直後の表に源氏名
    const re = /<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]{0,600}?(<figure[\s\S]*?<\/figure>)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(section))) {
      const e = toEntry(name, htmlText(m[1]), m[2], status, url);
      if (e) entries.set(`${e.shopName}|${e.displayName}`, e);
    }
    const reAcc = /<summary[^>]*>[\s\S]{0,400}?<span class="swl-format-1">([\s\S]*?)<\/span>[\s\S]{0,600}?(<figure[\s\S]*?<\/figure>)/g;
    while ((m = reAcc.exec(section))) {
      const e = toEntry(name, htmlText(m[1]), m[2], status, url);
      if (e) entries.set(`${e.shopName}|${e.displayName}`, e);
    }
  }
  return { name, imageUrl, entries: [...entries.values()] };
}
