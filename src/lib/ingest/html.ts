// 取り込み元のHTMLを読むための小さな共通部品（通信は行わない純粋関数のみ）
export const decodeHtml = (s: string): string =>
  s
    .replace(/&#0?38;|&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

/** <script>/<style>/<noscript> を落とす（本文だけを読みたいとき用） */
export const stripChrome = (html: string): string =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, "");

/** タグを落として空白をそろえたテキスト */
export const htmlText = (html: string): string => decodeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** <br> を改行に直したテキスト（1行ずつの項目を読むとき用） */
export const htmlLines = (html: string): string =>
  decodeHtml(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

/** 相対URLをページの絶対URLにする（http→https、ダミー画像は空） */
export function absoluteImageUrl(src: string, base: string): string {
  const s = decodeHtml(src).trim();
  if (!s || /noimage|now[_-]?printing|dummy|1x1|blank/i.test(s)) return "";
  try {
    const u = new URL(s, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    u.protocol = "https:";
    return u.toString();
  } catch {
    return "";
  }
}

/** og:image（属性の順番が違う書き方にも対応） */
export function ogImage(html: string, base: string): string {
  const a = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  const b = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["']/i);
  return absoluteImageUrl(a?.[1] ?? b?.[1] ?? "", base);
}

/** 女優名を alt に持つ画像（プロフィール画像） */
export function imageByAlt(html: string, base: string, alt: string): string {
  const esc = alt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = html.match(new RegExp(`<img[^>]+alt=["']${esc}["'][^>]+(?:src|data-src)=["']([^"']+)["']`, "i")) ??
    html.match(new RegExp(`<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]+alt=["']${esc}["']`, "i"));
  return absoluteImageUrl(m?.[1] ?? "", base);
}

/** ページ内の最初のDMM作品画像（avfuuzoku のように女優写真が無いページの最後の手段） */
export function firstDmmImage(html: string, base: string): string {
  const m = html.match(/(?:https?:)?\/\/(?:pics\.dmm\.co\.jp|awsimgsrc\.dmm\.co\.jp)\/[^"'\s]+?\.(?:jpg|jpeg|webp)/i);
  return m ? absoluteImageUrl(m[0], base) : "";
}
