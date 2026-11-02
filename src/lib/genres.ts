// 業種（地域×業種ページのURLにも使う）
// name はDBに入る値、label は画面に出す名前（例：風俗エステ → エステ）
export const GENRES = [
  { slug: "soap", name: "ソープ", label: "ソープ", color: "rose" },
  { slug: "deliveryhealth", name: "デリヘル", label: "デリヘル", color: "sky" },
  { slug: "chaideli", name: "チャイデリ", label: "チャイデリ", color: "amber" },
  { slug: "esthe", name: "風俗エステ", label: "エステ", color: "emerald" },
  { slug: "hotelhealth", name: "ホテヘル", label: "ホテヘル", color: "violet" },
  { slug: "fashionhealth", name: "店舗型ヘルス", label: "ヘルス", color: "cyan" },
  { slug: "pinsaro", name: "ピンサロ", label: "ピンサロ", color: "fuchsia" },
  { slug: "sm", name: "SM", label: "SM", color: "slate" },
  { slug: "other", name: "その他", label: "その他", color: "zinc" },
] as const;

export type GenreColor = (typeof GENRES)[number]["color"];

export function genreBySlug(slug: string) {
  return GENRES.find((g) => g.slug === slug);
}
export function genreByName(name: string) {
  return GENRES.find((g) => g.name === name || g.label === name);
}
export function genreLabel(name: string | null | undefined): string {
  if (!name) return "";
  return genreByName(name)?.label ?? name;
}
export function genreColor(name: string | null | undefined): GenreColor {
  return genreByName(name ?? "")?.color ?? "zinc";
}

/** 色付きバッジ（淡い背景） */
export const GENRE_BADGE_CLASSES: Record<GenreColor, string> = {
  rose: "border-rose-300 bg-rose-50 text-rose-700",
  sky: "border-sky-300 bg-sky-50 text-sky-700",
  amber: "border-amber-300 bg-amber-50 text-amber-800",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
  violet: "border-violet-300 bg-violet-50 text-violet-700",
  cyan: "border-cyan-300 bg-cyan-50 text-cyan-700",
  fuchsia: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700",
  slate: "border-slate-300 bg-slate-50 text-slate-700",
  zinc: "border-zinc-300 bg-zinc-50 text-zinc-700",
};

/** 絞り込みチップ（未選択） */
export const GENRE_CHIP_CLASSES: Record<GenreColor, string> = {
  rose: "border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100",
  sky: "border-sky-200 bg-sky-50/60 text-sky-700 hover:bg-sky-100",
  amber: "border-amber-200 bg-amber-50/60 text-amber-800 hover:bg-amber-100",
  emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100",
  violet: "border-violet-200 bg-violet-50/60 text-violet-700 hover:bg-violet-100",
  cyan: "border-cyan-200 bg-cyan-50/60 text-cyan-700 hover:bg-cyan-100",
  fuchsia: "border-fuchsia-200 bg-fuchsia-50/60 text-fuchsia-700 hover:bg-fuchsia-100",
  slate: "border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100",
  zinc: "border-zinc-200 bg-zinc-50/60 text-zinc-700 hover:bg-zinc-100",
};

/** 絞り込みチップ（選択中） */
export const GENRE_ACTIVE_CLASSES: Record<GenreColor, string> = {
  rose: "border-rose-600 bg-rose-600 text-white",
  sky: "border-sky-600 bg-sky-600 text-white",
  amber: "border-amber-500 bg-amber-500 text-white",
  emerald: "border-emerald-600 bg-emerald-600 text-white",
  violet: "border-violet-600 bg-violet-600 text-white",
  cyan: "border-cyan-600 bg-cyan-600 text-white",
  fuchsia: "border-fuchsia-600 bg-fuchsia-600 text-white",
  slate: "border-slate-600 bg-slate-600 text-white",
  zinc: "border-zinc-600 bg-zinc-600 text-white",
};

