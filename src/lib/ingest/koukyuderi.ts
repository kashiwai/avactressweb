// koukyuderi.jp/special/avjoyu.html（運営者の許可を得た取り込み元）のページ読み取り。通信は行わない純粋関数のみ
// 1ページに「AV女優名 / 特徴 / 源氏名 / 在籍店名 / 地域 / 電話番号」の表が、五十音ごとに分かれて載っている。
// 表ごとに分けて取り込めるよう、#t0, #t1 ... の目印を付けたURLを待ち行列に入れる。
import { prefCodeOfArea } from "./avfuzoku";
import { cleanDisplayName, normalizePhone, splitAreaGenre } from "./normalize";
import { decodeHtml, htmlText } from "./html";
import type { ScrapedEntry } from "./types";

export const KOUKYU_URL = "https://www.koukyuderi.jp/special/avjoyu.html";

const TABLE_RE = /<table class="special_avjoyu_list_table">([\s\S]*?)<\/table>/g;
const TBODY_RE = /<tbody>([\s\S]*?)<\/tbody>/g;
const TR_RE = /<tr>([\s\S]*?)<\/tr>/g;

/** ページ内の表の数（待ち行列に分けて入れるための数） */
export function countKoukyuderiTables(html: string): number {
  return [...html.matchAll(TABLE_RE)].length;
}

/** #t3 のような目印から、読む表の番号を取り出す */
export function tableIndexFromUrl(url: string): number | null {
  const m = url.match(/#t(\d+)$/);
  return m ? Number(m[1]) : null;
}

function cellsOf(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/g)].map((m) => htmlText(m[1]));
}

/** 表1つ分を在籍の一覧にする */
export function parseKoukyuderiTable(tableHtml: string, sourceUrl: string): ScrapedEntry[] {
  const out: ScrapedEntry[] = [];
  for (const tbody of tableHtml.matchAll(TBODY_RE)) {
    const block = tbody[1];
    const headCell = block.match(/<th[^>]*>([\s\S]*?)<\/th>/);
    let actressName = headCell ? htmlText(headCell[1]).trim() : "";
    let aliases: string[] = [];
    const alias = block.match(/<div class="alias">([\s\S]*?)<\/div>/);
    if (alias) {
      aliases = alias[1].split(/[、,・/／]/).map((x) => htmlText(x)).filter(Boolean);
      actressName = actressName.replace(htmlText(alias[1]), "").trim();
    }
    if (!actressName) {
      const first = block.match(TR_RE);
      if (first) actressName = cellsOf(first[1])[0] ?? "";
    }

    for (const tr of block.matchAll(TR_RE)) {
      const row = tr[1];
      const link = row.match(/<a[^>]*class="[^"]*gtm-av_shop_link[^"]*"[^>]*>/);
      if (!link) continue;
      const attr = (name: string) => decodeHtml(link[0].match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "");
      const shopName = (attr("data-shop_name") || htmlText(row)).trim();
      const avName = (attr("data-actress_name") || actressName).trim();
      if (!shopName || !avName) continue;

      // 行のセルは [源氏名][店名][地域][電話] の並び（先頭に女優名・特徴が付く表もある）
      const cells = cellsOf(row);
      const shopIdx = cells.findIndex((c) => c === shopName || c.includes(shopName));
      const displayName = cleanDisplayName(shopIdx > 0 ? cells[shopIdx - 1] : "");
      const areaRaw = shopIdx >= 0 ? cells[shopIdx + 1] ?? "" : "";
      const phone = shopIdx >= 0 ? cells[shopIdx + 2] ?? "" : "";
      const parts = splitAreaGenre(areaRaw);
      out.push({
        actressName: avName,
        aliases,
        displayName: displayName || avName,
        shopName,
        area: parts.area,
        // このサイトは高級デリヘル店の紹介。業種の記載が無い行はデリヘルとして扱う
        genre: parts.genre || "デリヘル",
        prefCode: prefCodeOfArea(parts.area) ?? prefCodeOfArea(shopName),
        phone: normalizePhone(phone) || undefined,
        sourceUrl,
        status: "active",
      });
    }
  }
  // 同じ女優・同じ店の重複を除く
  const seen = new Set<string>();
  return out.filter((e) => {
    const key = `${e.actressName}|${e.shopName}|${e.displayName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** ページ全体、または #tN で指定した表だけを読む */
export function parseKoukyuderi(html: string, url: string, tableIndex: number | null = null): ScrapedEntry[] {
  const tables = [...html.matchAll(TABLE_RE)].map((m) => m[0]);
  const picked = tableIndex == null ? tables : tables[tableIndex] ? [tables[tableIndex]] : [];
  return picked.flatMap((t) => parseKoukyuderiTable(t, url.replace(/#t\d+$/, "") + (tableIndex == null ? "" : `#t${tableIndex}`)));
}
