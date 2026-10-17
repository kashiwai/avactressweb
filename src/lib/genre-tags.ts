// 女優のジャンル（DUGA の作品カテゴリから集計）の扱い
// - どの女優にも付く大まかなもの（女優・企画など）は、近さの計算にも使わない
// - 公開画面には、決めておいた穏当なジャンルだけを表示する（それ以外は計算にだけ使う）

/** 近さの計算からも外す、意味の薄いジャンル */
export const IGNORED_GENRES = new Set(["女優", "企画", "その他", "総集編", "ベスト", "4時間以上作品", "単体作品", "独占配信", "ハイビジョン", "サンプル動画"]);

/**
 * 公開画面に表示してよいジャンル（ここに無いものは表示しない。近さの計算には使う）。
 * 伏せ字のもの・犯罪や未成年を連想させるもの・学校の制服など、表示に適さないものはここに入れない
 */
const DISPLAY_ALLOWED = new Set([
  "熟女", "人妻", "痴女", "巨乳", "おっぱい", "美乳", "お尻", "美脚", "ぽっちゃり", "スレンダー", "ギャル", "お姉さん",
  "アイドル", "素人", "M男", "女王様", "フェチ", "レズ", "ドラマ", "水着", "コスプレ", "OL", "美人", "清楚",
]);

export function displayGenres(genres: string[], limit = 4): string[] {
  return genres.filter((g) => DISPLAY_ALLOWED.has(g)).slice(0, limit);
}

/** 作品のカテゴリ一覧（作品ごとの配列）から、多い順のジャンルを作る */
export function summarizeGenres(perItem: string[][], limit = 10): string[] {
  const count = new Map<string, number>();
  for (const cats of perItem) for (const c of new Set(cats)) if (!IGNORED_GENRES.has(c)) count.set(c, (count.get(c) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([g]) => g);
}
