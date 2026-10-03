// 都道府県コード（JIS X 0401）
export const PREFECTURES = [
  { code: 1, name: "北海道", slug: "hokkaido", region: "北海道・東北" },
  { code: 2, name: "青森県", slug: "aomori", region: "北海道・東北" },
  { code: 3, name: "岩手県", slug: "iwate", region: "北海道・東北" },
  { code: 4, name: "宮城県", slug: "miyagi", region: "北海道・東北" },
  { code: 5, name: "秋田県", slug: "akita", region: "北海道・東北" },
  { code: 6, name: "山形県", slug: "yamagata", region: "北海道・東北" },
  { code: 7, name: "福島県", slug: "fukushima", region: "北海道・東北" },
  { code: 8, name: "茨城県", slug: "ibaraki", region: "関東" },
  { code: 9, name: "栃木県", slug: "tochigi", region: "関東" },
  { code: 10, name: "群馬県", slug: "gunma", region: "関東" },
  { code: 11, name: "埼玉県", slug: "saitama", region: "関東" },
  { code: 12, name: "千葉県", slug: "chiba", region: "関東" },
  { code: 13, name: "東京都", slug: "tokyo", region: "関東" },
  { code: 14, name: "神奈川県", slug: "kanagawa", region: "関東" },
  { code: 15, name: "新潟県", slug: "niigata", region: "甲信越・北陸" },
  { code: 16, name: "富山県", slug: "toyama", region: "甲信越・北陸" },
  { code: 17, name: "石川県", slug: "ishikawa", region: "甲信越・北陸" },
  { code: 18, name: "福井県", slug: "fukui", region: "甲信越・北陸" },
  { code: 19, name: "山梨県", slug: "yamanashi", region: "甲信越・北陸" },
  { code: 20, name: "長野県", slug: "nagano", region: "甲信越・北陸" },
  { code: 21, name: "岐阜県", slug: "gifu", region: "東海" },
  { code: 22, name: "静岡県", slug: "shizuoka", region: "東海" },
  { code: 23, name: "愛知県", slug: "aichi", region: "東海" },
  { code: 24, name: "三重県", slug: "mie", region: "東海" },
  { code: 25, name: "滋賀県", slug: "shiga", region: "関西" },
  { code: 26, name: "京都府", slug: "kyoto", region: "関西" },
  { code: 27, name: "大阪府", slug: "osaka", region: "関西" },
  { code: 28, name: "兵庫県", slug: "hyogo", region: "関西" },
  { code: 29, name: "奈良県", slug: "nara", region: "関西" },
  { code: 30, name: "和歌山県", slug: "wakayama", region: "関西" },
  { code: 31, name: "鳥取県", slug: "tottori", region: "中国・四国" },
  { code: 32, name: "島根県", slug: "shimane", region: "中国・四国" },
  { code: 33, name: "岡山県", slug: "okayama", region: "中国・四国" },
  { code: 34, name: "広島県", slug: "hiroshima", region: "中国・四国" },
  { code: 35, name: "山口県", slug: "yamaguchi", region: "中国・四国" },
  { code: 36, name: "徳島県", slug: "tokushima", region: "中国・四国" },
  { code: 37, name: "香川県", slug: "kagawa", region: "中国・四国" },
  { code: 38, name: "愛媛県", slug: "ehime", region: "中国・四国" },
  { code: 39, name: "高知県", slug: "kochi", region: "中国・四国" },
  { code: 40, name: "福岡県", slug: "fukuoka", region: "九州・沖縄" },
  { code: 41, name: "佐賀県", slug: "saga", region: "九州・沖縄" },
  { code: 42, name: "長崎県", slug: "nagasaki", region: "九州・沖縄" },
  { code: 43, name: "熊本県", slug: "kumamoto", region: "九州・沖縄" },
  { code: 44, name: "大分県", slug: "oita", region: "九州・沖縄" },
  { code: 45, name: "宮崎県", slug: "miyazaki", region: "九州・沖縄" },
  { code: 46, name: "鹿児島県", slug: "kagoshima", region: "九州・沖縄" },
  { code: 47, name: "沖縄県", slug: "okinawa", region: "九州・沖縄" },
] as const;

export function prefName(code: number): string {
  return PREFECTURES.find((p) => p.code === code)?.name ?? "不明";
}

export function prefBySlug(slug: string) {
  return PREFECTURES.find((p) => p.slug === slug);
}

export function prefByCode(code: number) {
  return PREFECTURES.find((p) => p.code === code);
}

export const REGIONS = Array.from(new Set(PREFECTURES.map((p) => p.region)));
