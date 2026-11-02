// DUGA の女優一覧（/main/av/）を全ページ読み、名前・よみがな・女優ID・顔写真の索引を作る
import "server-only";
import { decodeHtml, htmlText, stripChrome } from "./ingest/html";
import { normalizePersonName, splitPersonNames } from "./ingest/normalize";

export const DUGA_AV_INDEX = "https://duga.jp/main/av/";
const UA = { "User-Agent": "AVShukkinNaviBot/1.0 (+schedule aggregator; contact via site)" };

export type DugaIndexPerformer = {
  id: string;
  name: string;
  kana: string;
  works: number;
  imageUrl: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 1ページ分の女優カードを読む */
export function parseDugaActressList(html: string): DugaIndexPerformer[] {
  const body = stripChrome(html);
  const out: DugaIndexPerformer[] = [];
  const re =
    /<a href="https:\/\/duga\.jp\/search\/=\/performerid=(\d+)\/" class="actresslist">\s*<img[^>]+?(?:src|data-src)="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>\s*<span class="name">([\s\S]*?)<\/span><span class="kana">([\s\S]*?)<\/span><span class="count">([\s\S]*?)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const name = htmlText(m[4]);
    const kana = htmlText(m[5]).replace(/\s+/g, " ");
    const works = Number((htmlText(m[6]).match(/\d+/) ?? ["0"])[0]);
    if (!name) continue;
    out.push({ id: m[1], name, kana, works, imageUrl: decodeHtml(m[2]) });
  }
  // 念のため、alt から名前を拾える形にも対応
  if (out.length === 0) {
    for (const x of body.matchAll(/<a href="https:\/\/duga\.jp\/search\/=\/performerid=(\d+)\/" class="actresslist">([\s\S]*?)<\/a>/g)) {
      const block = x[2];
      const img = block.match(/<img[^>]+?(?:src|data-src)="([^"]+)"/);
      const name = htmlText(block.match(/<span class="name">([\s\S]*?)<\/span>/)?.[1] ?? "");
      const kana = htmlText(block.match(/<span class="kana">([\s\S]*?)<\/span>/)?.[1] ?? "");
      const works = Number((htmlText(block.match(/<span class="count">([\s\S]*?)<\/span>/)?.[1] ?? "").match(/\d+/) ?? ["0"])[0]);
      if (name) out.push({ id: x[1], name, kana, works, imageUrl: img ? decodeHtml(img[1]) : "" });
    }
  }
  return out;
}

/** 50音ページのリンク（/main/av/〜.html）を集める */
export function parseDugaIndexLinks(html: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(/href="(\/main\/av\/[a-z]+\.html)"/g)) urls.add(`https://duga.jp${m[1]}`);
  return [...urls];
}

/** 女優一覧を全ページ巡回して索引を作る（1ページ1秒間隔） */
export async function fetchDugaActressIndex(opts: { deadline?: number } = {}): Promise<DugaIndexPerformer[]> {
  const queue: string[] = [DUGA_AV_INDEX];
  const seen = new Set<string>();
  const byId = new Map<string, DugaIndexPerformer>();
  while (queue.length) {
    if (opts.deadline && Date.now() > opts.deadline) break;
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const res = await fetch(url, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const html = await res.text();
      for (const p of parseDugaActressList(html)) byId.set(p.id, p);
      for (const u of parseDugaIndexLinks(html)) if (!seen.has(u)) queue.push(u);
    } catch {
      // 1ページ失敗しても続ける
    }
    await sleep(1000);
  }
  return [...byId.values()];
}

export type DugaIndexMatch = { performer: DugaIndexPerformer; matchedBy: "氏名" | "よみがな" | "別名" };

/**
 * 名前・別名・よみがなから索引を引く。
 * 同じ名前が複数いる場合は、よみがなまで一致した1人だけを採用する（別人を結び付けない）。
 */
export function matchDugaIndex(
  actress: { name: string; kana: string; aliases: string[] },
  index: { byName: Map<string, DugaIndexPerformer[]>; byKana: Map<string, DugaIndexPerformer[]> },
): { kind: "matched"; match: DugaIndexMatch } | { kind: "ambiguous"; candidates: DugaIndexPerformer[] } | { kind: "unmatched" } {
  const parsed = splitPersonNames(actress.name);
  const names = [parsed.name, ...(actress.aliases ?? []), ...parsed.aliases].filter(Boolean);
  const nameKeys = [...new Set(names.map(normalizePersonName).filter((k) => k.length >= 2))];
  const kanaKey = normalizePersonName(actress.kana ?? "");

  const byName = new Map<string, { p: DugaIndexPerformer; by: DugaIndexMatch["matchedBy"] }>();
  for (const key of nameKeys) {
    for (const p of index.byName.get(key) ?? []) byName.set(p.id, { p, by: key === normalizePersonName(parsed.name) ? "氏名" : "別名" });
  }
  if (byName.size === 1) {
    const only = [...byName.values()][0];
    return { kind: "matched", match: { performer: only.p, matchedBy: only.by } };
  }
  if (byName.size > 1) {
    // よみがなまで一致する1人に絞れるか
    if (kanaKey.length >= 2) {
      const narrowed = [...byName.values()].filter(({ p }) => normalizePersonName(p.kana) === kanaKey);
      if (narrowed.length === 1) return { kind: "matched", match: { performer: narrowed[0].p, matchedBy: "よみがな" } };
    }
    return { kind: "ambiguous", candidates: [...byName.values()].map((x) => x.p) };
  }
  if (kanaKey.length >= 2) {
    const byKana = index.byKana.get(kanaKey) ?? [];
    if (byKana.length === 1) return { kind: "matched", match: { performer: byKana[0], matchedBy: "よみがな" } };
    if (byKana.length > 1) return { kind: "ambiguous", candidates: byKana };
  }
  return { kind: "unmatched" };
}

/** 索引を名前・よみがなで引ける形にする */
export function buildDugaIndex(performers: DugaIndexPerformer[]) {
  const byName = new Map<string, DugaIndexPerformer[]>();
  const byKana = new Map<string, DugaIndexPerformer[]>();
  for (const p of performers) {
    const nk = normalizePersonName(p.name);
    if (nk.length >= 2) byName.set(nk, [...(byName.get(nk) ?? []), p]);
    const kk = normalizePersonName(p.kana);
    if (kk.length >= 2) byKana.set(kk, [...(byKana.get(kk) ?? []), p]);
  }
  return { byName, byKana };
}
