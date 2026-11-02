/** 画像URLをきれいにする（http→https、空白除去、ダミー画像は空扱い） */
export function normalizeImageUrl(src?: string | null): string {
  if (!src) return "";
  const s = src.trim();
  if (!/^https?:\/\//i.test(s)) return "";
  if (/noimage|now[_-]?printing|dummy/i.test(s)) return "";
  return s.replace(/^http:\/\//i, "https://");
}

/** DUGA の作品表紙（1000x672の大きい画像）か */
export function isDugaJacket(src?: string | null): boolean {
  return /^https:\/\/pic\.duga\.jp\/.+\/jacket\.jpg$/i.test(normalizeImageUrl(src));
}

/**
 * 女優のアバター用のURL。
 * DUGA の作品表紙は 1000x672（約500KB）と重いので、同じ画像の小さい版（240x180）を使う。
 * 小さい版が無いときは AvatarImage 側で元の表紙に切り替える。
 */
export function avatarImageUrl(src?: string | null): string {
  const url = normalizeImageUrl(src);
  return isDugaJacket(url) ? url.replace(/jacket\.jpg$/i, "240x180.jpg") : url;
}

/** アバターの小さい版が無いときに使う元のURL（DUGAの表紙のみ） */
export function avatarFallbackUrl(src?: string | null): string {
  const url = normalizeImageUrl(src);
  return isDugaJacket(url) ? url : "";
}
