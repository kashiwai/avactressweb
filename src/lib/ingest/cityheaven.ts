// シティヘブンの「セクシー女優」一覧（typ27）の読み取り。通信は行わない純粋関数のみ
import { PREFECTURES } from "../prefectures";
import { normalizeGenre } from "./avzoku";

/** セクシー女優の絞り込み番号 */
export const SEXY_ACTRESS_TYPE = "typ27";

export const CITYHEAVEN_ORIGIN = "https://www.cityheaven.net";

/** 都道府県コード → シティヘブンのURLで使う地域名 */
const PREF_SLUG: Record<number, string> = {
  1: "hokkaido", 2: "aomori", 3: "iwate", 4: "miyagi", 5: "akita", 6: "yamagata", 7: "fukushima",
  8: "ibaraki", 9: "tochigi", 10: "gunma", 11: "saitama", 12: "chiba", 13: "tokyo", 14: "kanagawa",
  15: "niigata", 16: "toyama", 17: "ishikawa", 18: "fukui", 19: "yamanashi", 20: "nagano",
  21: "gifu", 22: "shizuoka", 23: "aichi", 24: "mie", 25: "shiga", 26: "kyoto", 27: "osaka",
  28: "hyogo", 29: "nara", 30: "wakayama", 31: "tottori", 32: "shimane", 33: "okayama",
  34: "hiroshima", 35: "yamaguchi", 36: "tokushima", 37: "kagawa", 38: "ehime", 39: "kochi",
  40: "fukuoka", 41: "saga", 42: "nagasaki", 43: "kumamoto", 44: "oita", 45: "miyazaki",
  46: "kagoshima", 47: "okinawa",
};

export function prefSlugOf(code: number): string | null {
  return PREF_SLUG[code] ?? null;
}

export function prefCodeOfSlug(slug: string): number | null {
  const hit = Object.entries(PREF_SLUG).find(([, v]) => v === slug);
  return hit ? Number(hit[0]) : null;
}

/** セクシー女優一覧のURL（1ページ100人） */
export function listUrl(prefCode: number, page = 1): string | null {
  const slug = prefSlugOf(prefCode);
  if (!slug) return null;
  return `${CITYHEAVEN_ORIGIN}/${slug}/girl-list/${SEXY_ACTRESS_TYPE}/${page > 1 ? `${page}/` : ""}`;
}

const decode = (s: string) =>
  s
    .replace(/&#0?38;|&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const text = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

export type CityheavenGirl = {
  /** シティヘブンの女の子ID（店舗をまたいで一意） */
  girlId: string;
  /** 店での名前（源氏名） */
  displayName: string;
  /** 女の子ページのURL（在籍の根拠として記録する） */
  girlUrl: string;
  shopName: string;
  shopUrl: string;
  genre: string;
  area: string;
  prefCode: number;
  /** 一覧を取得した日に出勤しているか */
  workingToday: boolean;
  age: number | null;
};

export type CityheavenListPage = {
  girls: CityheavenGirl[];
  /** 絞り込みに該当する総人数（ページ送りの判断に使う） */
  totalCount: number | null;
  hasNextPage: boolean;
};

/** 1件分のカードから読み取る。店舗URLから都道府県を判定できないものは捨てる */
function parseCard(card: string, fallbackPref: number): CityheavenGirl | null {
  const link = card.match(/<a class="shopimg" href="(\/([a-z]+)\/[^"]*\/girlid-(\d+)\/)"/);
  if (!link) return null;
  const [, path, prefSlug, girlId] = link;

  const nameBlock = card.match(/<p class="girlname">([\s\S]*?)<\/p>/);
  const displayName = nameBlock ? text(nameBlock[1].replace(/<span>\[\d+歳\]<\/span>/, "").replace(/<div class="main_girlListFooter-keep">[\s\S]*/, "")) : "";
  if (!displayName) return null;

  const shop = card.match(/<p class="shopname main_shopname"><a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/);
  const bizArea = card.match(/<p class="shopbiz_area">([^<]*)<\/p>/);
  const [rawGenre = "", area = ""] = bizArea ? text(bizArea[1]).split("/") : [];
  const age = card.match(/<span>\[(\d+)歳\]<\/span>/);

  return {
    girlId,
    displayName,
    girlUrl: CITYHEAVEN_ORIGIN + path,
    shopName: shop ? text(shop[2]) : "",
    shopUrl: shop ? CITYHEAVEN_ORIGIN + decode(shop[1]) : "",
    genre: normalizeGenre(rawGenre),
    area: area.trim(),
    prefCode: prefCodeOfSlug(prefSlug) ?? fallbackPref,
    workingToday: /class="soku">\s*本日出勤/.test(card),
    age: age ? Number(age[1]) : null,
  };
}

export function parseCityheavenList(html: string, prefCode: number): CityheavenListPage {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
  const cards = body.split('class="girls-list main_girls-list').slice(1);
  const girls: CityheavenGirl[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const g = parseCard(c, prefCode);
    if (g && !seen.has(g.girlId)) {
      seen.add(g.girlId);
      girls.push(g);
    }
  }
  const total = body.match(/<span class="shop_count" id='all-count_left'>([\d,]+)<\/span>/);
  return {
    girls,
    totalCount: total ? Number(total[1].replace(/,/g, "")) : null,
    hasNextPage: /次の100件/.test(body),
  };
}

/** 掲載対象の都道府県（全国） */
export const ALL_PREF_CODES = PREFECTURES.map((p) => p.code);
