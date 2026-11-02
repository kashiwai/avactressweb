// 取り込み元のページから読み取った「1件分の在籍」。DBへ反映する側（merge.ts）と読み取り側で共有する
export type EntrySchedule = { date: string; start: string | null; end: string | null };

export type ScrapedEntry = {
  /** AV女優名（取り込み元の表記のまま） */
  actressName: string;
  /** 括弧内などに書かれた別名 */
  aliases?: string[];
  kana?: string;
  /** お店での名前（源氏名） */
  displayName: string;
  shopName: string;
  area?: string;
  genre?: string;
  /** 分からないときは null（既存店舗の名前から決める） */
  prefCode: number | null;
  phone?: string;
  shopUrl?: string;
  /** 在籍の根拠URL */
  sourceUrl: string;
  /** 取り込み元に確認日があれば YYYY-MM-DD */
  verifiedAt?: string | null;
  /** 女優の写真として使える画像（取り込み元ページ内の画像。無ければ空） */
  actressImageUrl?: string;
  status: "active" | "left";
  schedules?: EntrySchedule[];
};

/** 1ページ＝1人の女優のページ（まとめサイト型） */
export type ScrapedActressPage = {
  name: string;
  kana?: string;
  aliases?: string[];
  /** 取り込み元ページの女優画像（DUGA/DMMに無いときの表示用） */
  imageUrl?: string;
  entries: ScrapedEntry[];
};
