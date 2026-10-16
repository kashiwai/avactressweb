// DUGA ウェブサービス（APEX アフィリエイト）連携
// キー未設定・APIエラー時は空を返し、画面側は作品欄ごと表示しない（ダミーは出さない）
// 利用制限：1アプリケーションIDあたり60秒間に60回まで
import "server-only";

const API = "https://affapi.duga.jp/search";

export function dugaConfigured(): boolean {
  return Boolean(process.env.DUGA_APP_ID && process.env.DUGA_AGENT_ID);
}

export type DugaPerformer = { id: string; name: string; kana: string };
export type DugaItem = {
  productId: string;
  title: string;
  affiliateUrl: string;
  jacketUrl: string; // 縦長の表紙（大）
  posterUrl: string; // 横長の画像（大）
  releaseDate: string; // YYYY-MM-DD
  performers: DugaPerformer[];
};

type ImgSet = Array<Record<string, string>> | undefined;
/** [{small},{midium},{large}] の形から、大きい順に1つ取り出す */
function pickImage(set: ImgSet): string {
  if (!Array.isArray(set)) return "";
  const flat = Object.assign({}, ...set) as Record<string, string>;
  return flat.large ?? flat.midium ?? flat.small ?? "";
}

type RawItem = {
  productid?: string;
  title?: string;
  affiliateurl?: string;
  jacketimage?: ImgSet;
  posterimage?: ImgSet;
  releasedate?: string;
  performer?: Array<{ data?: { id?: string | number; name?: string; kana?: string } }>;
};

function normalize(i: RawItem): DugaItem | null {
  if (!i.affiliateurl || !i.title) return null;
  return {
    productId: String(i.productid ?? i.affiliateurl),
    title: i.title,
    affiliateUrl: i.affiliateurl,
    jacketUrl: pickImage(i.jacketimage),
    posterUrl: pickImage(i.posterimage),
    releaseDate: (i.releasedate ?? "").replace(/\//g, "-").slice(0, 10),
    performers: (i.performer ?? [])
      .map((p) => p.data)
      .filter((d): d is NonNullable<typeof d> => Boolean(d?.name))
      .map((d) => ({ id: String(d.id ?? ""), name: String(d.name), kana: String(d.kana ?? "") })),
  };
}

/** キーワード（女優名）で作品を探す。cache は画面表示用（1日）か、裏の処理用（都度取得）かで切り替える */
export async function searchDuga(
  keyword: string,
  opts: { hits?: number; sort?: "favorite" | "release" | "new"; cache?: "day" | "none" } = {},
): Promise<{ ok: boolean; items: DugaItem[]; error?: string }> {
  if (!dugaConfigured()) return { ok: false, items: [], error: "DUGAのキーが未設定です" };
  const p = new URLSearchParams({
    version: "1.2",
    appid: process.env.DUGA_APP_ID ?? "",
    agentid: process.env.DUGA_AGENT_ID ?? "",
    bannerid: "01",
    format: "json",
    adult: "1",
    sort: opts.sort ?? "favorite",
    hits: String(Math.min(100, Math.max(1, opts.hits ?? 20))),
    keyword,
  });
  try {
    const res = await fetch(`${API}?${p}`, {
      ...(opts.cache === "day" ? { next: { revalidate: 86400 } } : { cache: "no-store" as const }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[duga] search http ${res.status}`);
      return { ok: false, items: [], error: `DUGAのAPIがエラーを返しました（${res.status}）` };
    }
    const json = (await res.json()) as { items?: Array<{ item?: RawItem }> };
    const items = (json.items ?? []).map((x) => normalize(x.item ?? {})).filter((x): x is DugaItem => x !== null);
    return { ok: true, items };
  } catch (e) {
    console.error("[duga] search failed", e instanceof Error ? e.message : e);
    return { ok: false, items: [], error: "DUGAのAPIに接続できませんでした" };
  }
}

const norm = (s: string) => s.normalize("NFKC").replace(/[\s　]/g, "");

/** 出演者の中から、名前が完全に一致する人を探す */
export function performersNamed(items: DugaItem[], name: string): DugaPerformer[] {
  const key = norm(name);
  const byId = new Map<string, DugaPerformer>();
  for (const it of items) for (const p of it.performers) if (norm(p.name) === key) byId.set(p.id, p);
  return [...byId.values()];
}

/** 女優ページ用：その女優（DUGA の女優番号で特定）が出演している作品を新しい順に */
export async function fetchDugaWorks(name: string, performerId: string, limit = 8): Promise<DugaItem[]> {
  const r = await searchDuga(name, { hits: 40, sort: "release", cache: "day" });
  return r.items.filter((it) => it.performers.some((p) => p.id === performerId)).slice(0, limit);
}
