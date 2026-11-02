// adultinfojpn.com/avfuzoku/（運営者の許可を得た取り込み元）のページ読み取り。通信は行わない純粋関数のみ
// 女優ページに「在籍店情報」（店舗名・源氏名・確認日）と「過去の在籍店情報（※退店）」が載っている。
// 店名の後ろの括弧に「(仙台デリヘル)」「(山梨県甲府ソープ)」のように地域と業種が入るので、店名と分けて読む。
import { prefCodeOfArea } from "./avfuzoku";
import { cleanDisplayName, nfkc, splitAreaGenre, splitPersonNames } from "./normalize";
import { htmlText, stripChrome, ogImage } from "./html";
import type { ScrapedActressPage, ScrapedEntry } from "./types";

export const ADULTINFO_ORIGIN = "https://adultinfojpn.com";

/** 女優ページ（/javstar/<slug>/）のURLを集める */
export function parseAdultinfoIndex(html: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(/href="(https:\/\/adultinfojpn\.com\/javstar\/[a-z0-9_-]+\/)"/gi)) urls.add(m[1]);
  return [...urls];
}

/** 「10/26/2026」「2026/10/26」を YYYY-MM-DD に直す */
export function parseAdultinfoDate(raw: string): string | null {
  const s = nfkc(raw);
  const mdy = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  const ymd = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  return null;
}

/** 店名のうしろの括弧から地域・業種を分ける（業種が無い括弧は店名の一部として残す） */
export function parseAdultinfoShop(raw: string): { shopName: string; area: string; genre: string; shopUrl: string } {
  const shopUrl = raw.match(/href="(https?:\/\/[^"]+)"/)?.[1] ?? "";
  const s = htmlText(raw);
  const groups = [...s.matchAll(/[（(]([^（）()]*)[）)]/g)];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    const parts = splitAreaGenre(g[1]);
    if (parts.genre || prefCodeOfArea(parts.area)) {
      const shopName = (s.slice(0, g.index) + s.slice((g.index ?? 0) + g[0].length)).replace(/\s+/g, " ").trim();
      if (shopName) return { shopName, area: parts.area, genre: parts.genre, shopUrl };
    }
  }
  return { shopName: s, area: "", genre: "", shopUrl };
}

/** 1つの段落（店舗名・源氏名・確認日）を読む */
function parseBlock(block: string, url: string): ScrapedEntry | null {
  const text = htmlText(block);
  if (!/源氏名/.test(text)) return null;
  const status: ScrapedEntry["status"] = /退店/.test(text) ? "left" : "active";

  let shopRaw = "";
  let rest = text;
  const withLabel = text.match(/店舗名[：:]\s*([\s\S]*)$/);
  if (withLabel) {
    shopRaw = withLabel[1].split(/源氏名[：:]/)[0];
    rest = text.slice(text.indexOf(shopRaw) + shopRaw.length);
  } else {
    shopRaw = text.split(/源氏名[：:]/)[0];
  }
  const nameRaw = rest.split(/源氏名[：:]/).slice(1).join("").split(/確認日[：:]/)[0].split(/※/)[0];

  const shop = parseAdultinfoShop(shopRaw);
  if (!shop.shopName) return null;
  const displayName = cleanDisplayName(
    nameRaw
      .replace(/[（(]\s*\d{1,2}\s*[)）]/g, "")
      .replace(/(?:確認日|退店|在籍).*$/, "")
      .trim(),
  ) || shop.shopName;

  const verifiedAt = parseAdultinfoDate(text.match(/確認日[：:]\s*([^\s]+)/)?.[1] ?? "");
  const prefCode = prefCodeOfArea(shop.area) ?? prefCodeOfArea(shop.shopName);
  return {
    actressName: "",
    displayName,
    shopName: shop.shopName,
    area: shop.area,
    genre: shop.genre,
    prefCode,
    shopUrl: shop.shopUrl,
    sourceUrl: url,
    verifiedAt,
    status,
  };
}

/** 女優ページ：在籍店情報と過去の在籍店情報を読み取る */
export function parseAdultinfoActress(html: string, url: string): ScrapedActressPage | null {
  const body = stripChrome(html);
  const h1 = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
  const title = htmlText(h1 || body.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || "");
  const name = title.replace(/の風俗.*$/, "").replace(/^「|」$/g, "").trim();
  if (!name) return null;
  const parsed = splitPersonNames(name);
  const imageUrl = ogImage(body, url);

  // 「在籍店情報」「過去の在籍店情報」の見出しを探す（目次の中の文字は見出しではない）
  const headings = [...body.matchAll(/<h([234])[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    text: htmlText(m[2]),
  }));
  const curIdx = headings.map((h) => h.text).lastIndexOf("在籍店情報");
  const cur = curIdx >= 0 ? headings[curIdx] : null;
  const pastIdx = headings.findIndex((h, i) => i > curIdx && /過去の在籍店情報/.test(h.text));
  const past = pastIdx >= 0 ? headings[pastIdx] : null;
  if (!cur) return { name: parsed.name, aliases: parsed.aliases, imageUrl, entries: [] };

  const curEnd = past ? past.start : (headings[curIdx + 1]?.start ?? Math.min(body.length, cur.end + 6000));
  const curSection = body.slice(cur.end, curEnd);
  const pastSection = past ? body.slice(past.end, headings[pastIdx + 1]?.start ?? Math.min(body.length, past.end + 6000)) : "";

  const entries = new Map<string, ScrapedEntry>();
  for (const section of [curSection, pastSection]) {
    for (const m of section.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
      const e = parseBlock(m[1], url);
      if (!e) continue;
      e.actressName = name;
      e.aliases = parsed.aliases;
      // 同じ店・同じ源氏名の重複（現役と過去の両方に載る等）は、現役を優先する
      const key = `${e.shopName}|${e.displayName}`;
      const prev = entries.get(key);
      if (!prev || (prev.status === "left" && e.status === "active")) entries.set(key, e);
    }
  }
  return { name: parsed.name, aliases: parsed.aliases, imageUrl, entries: [...entries.values()] };
}
