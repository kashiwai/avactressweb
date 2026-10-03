// 業種（地域×業種ページのURLにも使う）
export const GENRES = [
  { slug: "deliveryhealth", name: "デリヘル" },
  { slug: "hotelhealth", name: "ホテヘル" },
  { slug: "fashionhealth", name: "店舗型ヘルス" },
  { slug: "soap", name: "ソープ" },
  { slug: "esthe", name: "風俗エステ" },
  { slug: "pinsaro", name: "ピンサロ" },
  { slug: "sm", name: "SM" },
  { slug: "other", name: "その他" },
] as const;

export function genreBySlug(slug: string) {
  return GENRES.find((g) => g.slug === slug);
}
export function genreByName(name: string) {
  return GENRES.find((g) => g.name === name);
}
