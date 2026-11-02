// 源氏名とセクシー女優名の照合。確実なものだけ自動で結び付け、迷うものは運営者の確認に回す
import { normalizePersonName, splitPersonNames } from "./normalize";

/** 照合用に名前をそろえる（記号・空白・敬称・装飾を落とし、カタカナはひらがなへ） */
export function normalizeName(raw: string): string {
  return normalizePersonName(raw);
}

export type MatchCandidate = { actressId: number; name: string; kana: string; aliases?: string[] | null };

export type MatchResult =
  | { kind: "matched"; actressId: number; reason: "氏名一致" | "よみがな一致" | "別名一致" }
  | { kind: "ambiguous"; candidates: MatchCandidate[] }
  | { kind: "unmatched" };

/**
 * 源氏名を、掲載中のセクシー女優と照合する。
 * 「有村のぞみ(早川ひとみ・中井のぞみ)」のような別名表記は、本人名・別名のどれかが一致すれば同じ人とみなす。
 * 一致が1人に定まったときだけ結び付け、複数該当・不一致は運営者の確認に回す。
 * 部分一致（「ひかる」で「凪沢ひかる」に当てる等）は別人を結び付ける危険があるため行わない。
 */
export function matchActressName(displayName: string, candidates: MatchCandidate[]): MatchResult {
  const parsed = splitPersonNames(displayName);
  const keys = [...new Set([parsed.name, ...parsed.aliases].map(normalizePersonName).filter((k) => k.length >= 2))];
  if (keys.length === 0) return { kind: "unmatched" };

  const nameKeys = (c: MatchCandidate) => [c.name, ...(c.aliases ?? [])].map(normalizePersonName);
  const byName = candidates.filter((c) => nameKeys(c).some((k) => keys.includes(k)));
  if (byName.length === 1) {
    const exact = normalizePersonName(byName[0].name) === normalizePersonName(parsed.name);
    return { kind: "matched", actressId: byName[0].actressId, reason: exact ? "氏名一致" : "別名一致" };
  }
  if (byName.length > 1) return { kind: "ambiguous", candidates: byName };

  const kanaKeys = [parsed.name, ...parsed.aliases].map(normalizePersonName).filter((k) => k.length >= 2);
  const byKana = candidates.filter((c) => c.kana && kanaKeys.includes(normalizePersonName(c.kana)));
  if (byKana.length === 1) return { kind: "matched", actressId: byKana[0].actressId, reason: "よみがな一致" };
  if (byKana.length > 1) return { kind: "ambiguous", candidates: byKana };

  return { kind: "unmatched" };
}

/** 姓と名の間の空白を除いた形も同じ名前として扱えるか確かめる（表記ゆれの吸収） */
export function sameNameLoosely(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}
