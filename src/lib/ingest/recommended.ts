// 運営者が許可を得ている取り込み元の一覧（管理画面の「まとめて登録」で使う）
export type RecommendedSource = { name: string; kind: "avzoku" | "avfuzoku"; url: string; maxPages: number };

export const RECOMMENDED_SOURCES: RecommendedSource[] = [
  { name: "avzoku 東京デリヘル", kind: "avzoku", url: "https://avzoku.com/schedule/tokyo-deliveryhealth/", maxPages: 7 },
  { name: "avzoku 吉原ソープ", kind: "avzoku", url: "https://avzoku.com/schedule/yoshiwara-soap/", maxPages: 7 },
  { name: "avzoku 川崎ソープ", kind: "avzoku", url: "https://avzoku.com/schedule/kawasaki-soap/", maxPages: 7 },
  { name: "avzoku 関東", kind: "avzoku", url: "https://avzoku.com/schedule/kanto-fuzoku/", maxPages: 7 },
  { name: "avzoku 東北", kind: "avzoku", url: "https://avzoku.com/schedule/tohoku-fuzoku/", maxPages: 7 },
  { name: "avzoku 中部", kind: "avzoku", url: "https://avzoku.com/schedule/chubu-fuzoku/", maxPages: 7 },
  { name: "avzoku 関西", kind: "avzoku", url: "https://avzoku.com/schedule/kansai-fuzoku/", maxPages: 7 },
  { name: "avzoku 中国", kind: "avzoku", url: "https://avzoku.com/schedule/chugoku-fuzoku/", maxPages: 7 },
  { name: "avzoku 九州", kind: "avzoku", url: "https://avzoku.com/schedule/kyushu-fuzoku/", maxPages: 7 },
  { name: "avfuzoku 在籍情報", kind: "avfuzoku", url: "https://www.avfuzoku-soap-deli.com/sitemap.html", maxPages: 1 },
];
