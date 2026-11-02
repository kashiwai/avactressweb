// 待ち行列で扱う取り込み元の一覧と、ページ種別ごとの「一覧の集め方」「1ページの反映の仕方」
import "server-only";
import { todayJst } from "../dates";
import { parseAvzokuActress, parseAvzokuList } from "./avzoku";
import { parseAvfuzokuActress, parseAvfuzokuIndex, parseEntryLabel, prefCodeOfArea } from "./avfuzoku";
import { parseAdultinfoActress, parseAdultinfoIndex } from "./adultinfo";
import { parseFuuavActress, parseFuuavIndex } from "./fuuav";
import { countKoukyuderiTables, parseKoukyuderi, tableIndexFromUrl } from "./koukyuderi";
import { parseAvfuuzokuDetail, parseAvfuuzokuIndex } from "./avfuuzoku";
import { applyScrapedEntries } from "./merge";
import type { ScrapedEntry } from "./types";

/** 待ち行列で処理する取り込み元の種類 */
export const QUEUED_KINDS = ["avzoku", "avfuzoku", "adultinfo", "fuuav", "koukyuderi", "avfuuzoku"] as const;
export type QueuedKind = (typeof QUEUED_KINDS)[number];
export const isQueuedKind = (k: string): k is QueuedKind => (QUEUED_KINDS as readonly string[]).includes(k);

/** 一覧を読み直す間隔（日）。毎日取り込む（ページ数が多いサイトは待ち行列で少しずつ処理する） */
export const INTERVAL_DAYS: Record<QueuedKind, number> = {
  avzoku: 1,
  avfuzoku: 1,
  adultinfo: 1,
  fuuav: 1,
  koukyuderi: 1,
  avfuuzoku: 1,
};

type Io = {
  getHtml: (url: string) => Promise<string>;
  sleep: (ms: number) => Promise<void>;
  maxPages: number;
  deadline?: number;
};

/** 一覧ページから、待ち行列に入れるURLを集める */
export async function collectSourceUrls(kind: QueuedKind, url: string, io: Io): Promise<string[]> {
  const urls = new Set<string>();
  if (kind === "avfuzoku") {
    parseAvfuzokuIndex(await io.getHtml(url)).forEach((u) => urls.add(u));
    return [...urls];
  }
  if (kind === "adultinfo") {
    parseAdultinfoIndex(await io.getHtml(url)).forEach((u) => urls.add(u));
    return [...urls];
  }
  if (kind === "avfuuzoku") {
    parseAvfuuzokuIndex(await io.getHtml(url)).forEach((u) => urls.add(u));
    return [...urls];
  }
  if (kind === "koukyuderi") {
    const n = countKoukyuderiTables(await io.getHtml(url));
    for (let i = 0; i < n; i++) urls.add(`${url}#t${i}`);
    return [...urls];
  }
  if (kind === "fuuav") {
    let next: string | null = url;
    for (let page = 0; next && page < Math.max(1, io.maxPages); page++) {
      if (io.deadline && Date.now() > io.deadline) break;
      const parsed = parseFuuavIndex(await io.getHtml(next));
      parsed.actressUrls.forEach((u) => urls.add(u));
      next = parsed.nextUrl;
      await io.sleep(1000);
    }
    return [...urls];
  }
  // avzoku（地域別の出勤一覧。日付のページ送り）
  let next: string | null = url;
  for (let page = 0; next && page < Math.max(1, io.maxPages); page++) {
    if (io.deadline && Date.now() > io.deadline) break;
    const parsed = parseAvzokuList(await io.getHtml(next));
    parsed.actressUrls.forEach((u) => urls.add(u));
    next = parsed.nextUrl;
    await io.sleep(1000);
  }
  return [...urls];
}

export type QueuedApplyResult = { applied: number; createdActress: boolean; createdShop: boolean; note: string | null };

const resultOf = (r: { applied: number; createdActresses: number; createdShops: number; unmatched: string[] }, prefix = "") => ({
  applied: r.applied,
  createdActress: r.createdActresses > 0,
  createdShop: r.createdShops > 0,
  note: r.unmatched.length ? `${prefix}${r.unmatched.slice(0, 5).join("、")}` : null,
});

/** 1ページ分を読み取って、在籍・出勤へ反映する */
export async function applyQueuedUrl(
  kind: QueuedKind,
  url: string,
  getHtml: (u: string) => Promise<string>,
  today = todayJst(),
): Promise<QueuedApplyResult> {
  if (kind === "avzoku") {
    const a = parseAvzokuActress(await getHtml(url), url, today);
    if (!a) return { applied: 0, createdActress: false, createdShop: false, note: `読み取れませんでした：${url}` };
    const entry: ScrapedEntry = {
      actressName: a.name,
      kana: a.kana,
      displayName: a.displayName,
      shopName: a.shopName,
      area: a.area,
      genre: a.genre,
      prefCode: a.prefCode,
      shopUrl: a.shopUrl,
      sourceUrl: url,
      verifiedAt: a.verifiedAt,
      status: "active",
      schedules: a.schedules,
    };
    return resultOf(await applyScrapedEntries([entry], { today, sourceImageUrl: a.imageUrl }));
  }

  if (kind === "avfuzoku") {
    const a = parseAvfuzokuActress(await getHtml(url), url);
    if (!a) return { applied: 0, createdActress: false, createdShop: false, note: `読み取れませんでした：${url}` };
    const entries: ScrapedEntry[] = a.entries.map((e) => ({
      actressName: a.name,
      aliases: a.aliases,
      kana: a.kana,
      displayName: e.displayName || a.name,
      shopName: e.shopName,
      area: e.area,
      genre: e.genre,
      prefCode: e.prefCode,
      shopUrl: e.shopUrl,
      sourceUrl: url,
      verifiedAt: today,
      status: "active",
    }));
    // 「※A(地域業種)は退店しました」は、店名だけで退店として反映する
    for (const name of a.leftShops) {
      const parsed = parseEntryLabel(`${name} -`);
      entries.push({
        actressName: a.name,
        aliases: a.aliases,
        kana: a.kana,
        displayName: a.name,
        shopName: parsed?.shopName ?? name,
        area: parsed?.area,
        genre: parsed?.genre,
        prefCode: parsed?.area ? prefCodeOfArea(parsed.area) : null,
        sourceUrl: url,
        verifiedAt: today,
        status: "left",
      });
    }
    return resultOf(
      await applyScrapedEntries(entries, { today, prune: { actressName: a.name, aliases: a.aliases, sourceUrl: url }, sourceImageUrl: a.imageUrl }),
      `${a.name}：`,
    );
  }

  if (kind === "adultinfo") {
    const a = parseAdultinfoActress(await getHtml(url), url);
    if (!a) return { applied: 0, createdActress: false, createdShop: false, note: `読み取れませんでした：${url}` };
    return resultOf(
      await applyScrapedEntries(a.entries, { today, prune: { actressName: a.name, aliases: a.aliases, sourceUrl: url }, sourceImageUrl: a.imageUrl }),
      `${a.name}：`,
    );
  }

  if (kind === "fuuav") {
    const a = parseFuuavActress(await getHtml(url), url);
    if (!a) return { applied: 0, createdActress: false, createdShop: false, note: `読み取れませんでした：${url}` };
    return resultOf(await applyScrapedEntries(a.entries, { today, prune: { actressName: a.name, sourceUrl: url }, sourceImageUrl: a.imageUrl }), `${a.name}：`);
  }

  if (kind === "koukyuderi") {
    const tableIndex = tableIndexFromUrl(url);
    const entries = parseKoukyuderi(await getHtml(url.replace(/#t\d+$/, "")), url, tableIndex);
    if (entries.length === 0) return { applied: 0, createdActress: false, createdShop: false, note: `読み取れませんでした：${url}` };
    return resultOf(await applyScrapedEntries(entries, { today }));
  }

  // avfuuzoku（1ページ＝女優1人×店1店）
  if (kind === "avfuuzoku") {
    const e = parseAvfuuzokuDetail(await getHtml(url), url);
    if (!e) return { applied: 0, createdActress: false, createdShop: false, note: `読み取れませんでした：${url}` };
    const r = resultOf(await applyScrapedEntries([e], { today, sourceImageUrl: e.actressImageUrl }));
    return r.applied === 0 && e.status === "left" ? { ...r, note: `${e.actressName}（退店）` } : r;
  }

  throw new Error(`待ち行列の対象ではない形式です（${kind}）`);
}
