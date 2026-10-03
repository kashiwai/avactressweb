// DMM Web Service API v3 連携（アフィリエイト）
// キー未設定・APIエラー時は空を返し、画面側は作品欄ごと表示しない（ダミーは出さない）
import "server-only";

const API = "https://api.dmm.com/affiliate/v3";

export function dmmConfigured(): boolean {
  return Boolean(process.env.DMM_API_ID && process.env.DMM_AFFILIATE_ID);
}

function baseParams(): URLSearchParams {
  return new URLSearchParams({
    api_id: process.env.DMM_API_ID ?? "",
    affiliate_id: process.env.DMM_AFFILIATE_ID ?? "",
    output: "json",
  });
}

export type DmmItem = {
  contentId: string;
  title: string;
  affiliateUrl: string;
  imageUrl: string;
  date: string;
};

type RawItem = {
  content_id: string;
  title: string;
  affiliateURL?: string;
  URL?: string;
  imageURL?: { list?: string; small?: string; large?: string };
  date?: string;
};

/** 女優の新着作品（FANZA動画）。1日キャッシュ */
export async function fetchActressItems(dmmActressId: string, hits = 8): Promise<DmmItem[]> {
  if (!dmmConfigured() || !/^\d+$/.test(dmmActressId)) return [];
  const p = baseParams();
  p.set("site", "FANZA");
  p.set("service", "digital");
  p.set("floor", "videoa");
  p.set("hits", String(hits));
  p.set("sort", "date");
  p.set("article", "actress");
  p.set("article_id", dmmActressId);
  try {
    const res = await fetch(`${API}/ItemList?${p}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.error(`[dmm] ItemList http ${res.status}`);
      return [];
    }
    const json = (await res.json()) as { result?: { status?: number; items?: RawItem[] } };
    const items = json.result?.items ?? [];
    return items
      .filter((i) => i.affiliateURL)
      .map((i) => ({
        contentId: i.content_id,
        title: i.title,
        affiliateUrl: i.affiliateURL!,
        imageUrl: i.imageURL?.large ?? i.imageURL?.list ?? "",
        date: (i.date ?? "").slice(0, 10),
      }));
  } catch (e) {
    console.error("[dmm] ItemList failed", e instanceof Error ? e.message : e);
    return [];
  }
}

export type DmmActress = { id: string; name: string; ruby: string; imageUrl: string };

/** 女優名で検索（管理画面の紐付け用・キャッシュしない） */
export async function searchDmmActress(keyword: string): Promise<{ ok: boolean; items: DmmActress[]; error?: string }> {
  if (!dmmConfigured()) return { ok: false, items: [], error: "DMMのAPIキーが未設定です。環境変数 DMM_API_ID と DMM_AFFILIATE_ID を設定してください。" };
  const p = baseParams();
  p.set("keyword", keyword);
  p.set("hits", "20");
  try {
    const res = await fetch(`${API}/ActressSearch?${p}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, items: [], error: `DMMのAPIがエラーを返しました（${res.status}）。キーが正しいか確認してください。` };
    const json = (await res.json()) as {
      result?: { actress?: Array<{ id: string | number; name: string; ruby?: string; imageURL?: { large?: string; small?: string } }> };
    };
    const items = (json.result?.actress ?? []).map((a) => ({
      id: String(a.id),
      name: a.name,
      ruby: a.ruby ?? "",
      imageUrl: a.imageURL?.large ?? a.imageURL?.small ?? "",
    }));
    return { ok: true, items };
  } catch (e) {
    console.error("[dmm] ActressSearch failed", e instanceof Error ? e.message : e);
    return { ok: false, items: [], error: "DMMのAPIに接続できませんでした。時間をおいてもう一度お試しください。" };
  }
}
