// 源氏名とセクシー女優名の照合。確実なものだけ自動で結び付け、迷うものは運営者の確認に回す
import { normalizeQuery } from "../search";

/** 照合用に名前をそろえる（記号・空白・敬称・装飾を落とし、カタカナはひらがなへ） */
export function normalizeName(raw: string): string {
  return normalizeQuery(
    raw
      .replace(/[【（(\[［].*?[】）)\]］]/g, "") // 【S】ひなた → ひなた
      .replace(/[☆★♡♥♪◆■※~〜・.,、。]/g, "")
      .replace(/(ちゃん|さん|様)$/, ""),
  ).replace(/\s+/g, "");
}

export type MatchCandidate = { actressId: number; name: string; kana: string };

export type MatchResult =
  | { kind: "matched"; actressId: number; reason: "氏名一致" | "よみがな一致" }
  | { kind: "ambiguous"; candidates: MatchCandidate[] }
  | { kind: "unmatched" };

/**
 * 源氏名を、掲載中のセクシー女優と照合する。
 * 一致が1人に定まったときだけ結び付け、複数該当・不一致は運営者の確認に回す。
 * 部分一致（「ひかる」で「凪沢ひかる」に当てる等）は別人を結び付ける危険があるため行わない。
 */
export function matchActressName(displayName: string, candidates: MatchCandidate[]): MatchResult {
  const key = normalizeName(displayName);
  if (key.length < 2) return { kind: "unmatched" };

  const byName = candidates.filter((c) => normalizeName(c.name) === key);
  if (byName.length === 1) return { kind: "matched", actressId: byName[0].actressId, reason: "氏名一致" };
  if (byName.length > 1) return { kind: "ambiguous", candidates: byName };

  const byKana = candidates.filter((c) => c.kana && normalizeName(c.kana) === key);
  if (byKana.length === 1) return { kind: "matched", actressId: byKana[0].actressId, reason: "よみがな一致" };
  if (byKana.length > 1) return { kind: "ambiguous", candidates: byKana };

  return { kind: "unmatched" };
}

/** 姓と名の間の空白を除いた形も同じ名前として扱えるか確かめる（表記ゆれの吸収） */
export function sameNameLoosely(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}
