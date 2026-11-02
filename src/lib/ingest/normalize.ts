// 名前・店名の表記ゆれをそろえる（通信もDBも使わない純粋関数のみ）
// 取り込み元ごとに「葵爽」「葵 爽」「葵爽（あおいそう）」のような書き方が違うため、
// 比較用のキーに直してから照合する。表示に使う文字列は元のまま残す。
import { normalizeGenre } from "./avzoku";

/** 全角英数・半角カナなどをそろえる */
export const nfkc = (s: string): string => s.normalize("NFKC").replace(/\s+/g, " ").trim();

/** カタカナ→ひらがな（「ソウ」と「そう」を同じものとして扱う） */
export const toHiragana = (s: string): string => s.replace(/[ァ-ヺ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** 業種名の末尾（店名の括弧から地域と業種を分けるときに使う） */
export const GENRE_SUFFIX =
  /(ニューハーフデリヘル|ニューハーフヘルス|メンズエステ|メンエス|ソープランド|ソープ|ホテルヘルス|ホテヘル|チャイニーズデリヘル|チャイナデリヘル|中国デリヘル|チャイデリ|デリバリーヘルス|デリヘル|箱ヘル|店舗型ヘルス|性感エステ|回春エステ|風俗エステ|エステ|ピンサロ|SMクラブ|SM|イメクラ|オナクラ|手コキ|待ち合わせ)$/;

/** 「福岡発」「池袋発〜東京23区」のような表記から、地域名だけにする */
const cleanArea = (s: string): string =>
  s
    .replace(/[（(]/g, "")
    .replace(/[)）]/g, "")
    .replace(/[〜~～].*$/, "")
    .replace(/発$/, "")
    .replace(/(?:エリア|周辺|近郊)$/, "")
    .trim();

/** 「千葉県船橋・デリヘル」「渋谷（ホテヘル）」「都内メンズエステ」を地域と業種に分ける */
export function splitAreaGenre(raw: string): { area: string; genre: string } {
  const s = nfkc(raw).replace(/[（(]/g, "").replace(/[)）]/g, "");
  const parts = s.split(/[・/／]/).map((x) => x.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  const g = last.match(GENRE_SUFFIX);
  if (g && parts.length > 1) {
    return { area: cleanArea(parts.slice(0, -1).join("・")), genre: normalizeGenre(g[0]) };
  }
  const inline = s.match(GENRE_SUFFIX);
  if (inline) {
    const area = s.slice(0, -inline[0].length).replace(/[・/／]$/, "").trim();
    return { area: cleanArea(area), genre: normalizeGenre(inline[0]) };
  }
  return { area: cleanArea(s), genre: "" };
}

const NAME_NOISE = /^(?:\d+歳?|\d+|\?|不明|非公開|秘密|なし|特になし|新人|現役|引退|AV女優|素人|既婚|独身)$/;

/** 照合用の女優名キー（記号・空白・装飾・年齢を落とし、カタカナはひらがなへ） */
export function normalizePersonName(raw: string): string {
  return toHiragana(nfkc(raw))
    .replace(/[（(【\[［][^）)】\]］]*[）)】\]］]/g, "")
    .replace(/[☆★♡♥♪◆■※~〜・.,、。!！?？'"“”‘’`´\-‐–—_:：;；/／|｜]/g, "")
    .replace(/\s+/g, "")
    .replace(/(ちゃん|さん|様)$/, "")
    .toLowerCase()
    .slice(0, 60);
}

/** 女優名として扱ってよいか（FC2の品番だけの行などを女優として作らないための歯止め） */
export function isPlausibleActressName(raw: string): boolean {
  const s = nfkc(raw);
  if (!s) return false;
  // FC2-PPV-123456 のような品番だけの名前は女優名ではない
  if (/FC2[\s\-_]*(?:PPV)?/i.test(s)) return false;
  if (/^(?:PPV|FC2)[\s\-_\d,、]+$/i.test(s)) return false;
  const key = normalizePersonName(s);
  if (key.length < 2) return false;
  if (NAME_NOISE.test(key)) return false;
  if (!/[一-龯々ぁ-ゖァ-ヺa-z]/i.test(key)) return false;
  // 伏せ字だけ（〇○◯◎●＊*）の名前は本人特定に使えない
  if (/^[〇○◯◎●＊*]+$/.test(key)) return false;
  return true;
}

/** 女優名の表記から「本人名」と「別名（括弧内・カンマ区切り）」を取り出す */
export function splitPersonNames(raw: string): { name: string; aliases: string[] } {
  const s = nfkc(raw);
  const primary = s.split(/[、,]/)[0].replace(/[（(【\[［][^）)】\]］]*[）)】\]］]/g, "").trim();
  const aliases: string[] = [];
  for (const m of s.matchAll(/[（(【\[［]([^）)】\]］]*)[）)】\]］]/g)) {
    for (const part of m[1].split(/[・、,／/]/)) aliases.push(part.trim());
  }
  for (const part of s.split(/[、,]/).slice(1)) {
    // 「サンディー・雛・パークス」のような並記は、そのまま1つの別名として持つ
    aliases.push(part.replace(/[（(【\[［][^）)】\]］]*[）)】\]］]/g, "").trim());
  }
  const clean = (x: string) => x.replace(/^\d+歳?$/, "").trim();
  return {
    name: clean(primary),
    aliases: [...new Set(aliases.map(clean).filter((a) => a && !NAME_NOISE.test(a) && !/^[（(]?\d+[)）]?$/.test(a)))].slice(0, 10),
  };
}

/** 店名の照合キー（空白・装飾・末尾の地域業種の括弧を落とす） */
export function normalizeShopName(raw: string): string {
  return nfkc(raw)
    .replace(/[（(][^（）()]*[）)]\s*$/g, "")
    .replace(/[\s　]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[☆★♡♥♪◆■※~〜・.,、。!！?？"“”\-‐–—_:：;；/／|｜]/g, "")
    .toLowerCase()
    .slice(0, 80);
}

/** 電話番号の照合キー（数字だけ）。店名が違っても同じ店をまとめるのに使う */
export function normalizePhone(raw: string | null | undefined): string {
  return nfkc(raw ?? "").replace(/\D/g, "");
}

/** 表示用の源氏名から年齢「(22)」や退店の注記を落とす */
export function cleanDisplayName(raw: string): string {
  return nfkc(raw)
    .replace(/[（(]\s*\d{1,2}\s*[)）]\s*$/g, "")
    .replace(/\[(?:退店|閉店)\]/g, "")
    .trim()
    .slice(0, 60);
}

/** 源氏名の伏せ字（〇○◯◎●＊*）を含むか */
export const isMaskedName = (raw: string): boolean => /[〇○◯◎●＊*]/.test(raw);
