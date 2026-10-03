// シティヘブン「セクシー女優」一覧を書き出した CSV / JSON（Thunderbit 形式）を取り込む
//
// 使い方: bun --env-file=.env.local scripts/import-thunderbit.ts <ファイルまたはフォルダ> [...]
//         --dry-run を付けると、DBに書き込まずに件数だけ表示する
//
// 方針（自動取り込みと同じ）:
//  - 源氏名が、掲載中の女優の名前・よみがなと完全一致で1人に定まったときだけ在籍を作る
//  - それ以外はすべて「確認待ち」（公開画面には出ない）に入れ、運営者が判断する
//  - 伏せ字（〇○◯◎●＊*）入りの名前は、お店が名前を伏せているものとして扱い、確認待ちにも
//    「推測で結び付けない」旨を書き添える
//  - 「出勤スケジュール」列があれば、結び付いた在籍にだけ日ごとの出勤・休みを入れる
//  - 全在籍一覧から書き出したファイルは、AV女優である旨の記載がある行だけを扱う
//  - 写真・年齢・身長・スリーサイズ・料金は取り込まない（写真は店舗の著作物のため）
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { todayJst } from "../src/lib/dates";
import { CITYHEAVEN_ORIGIN, prefCodeOfSlug } from "../src/lib/ingest/cityheaven";
import { normalizeGenre } from "../src/lib/ingest/avzoku";

const { actresses, candidateGirls, enrollments, schedules, shops } = schema;

type Row = Record<string, string>;
type Girl = {
  girlId: string;
  displayName: string;
  girlUrl: string;
  shopName: string;
  shopUrl: string;
  genre: string;
  area: string;
  prefCode: number;
  masked: boolean;
  isAv: boolean;
  schedule: Day[];
};

const MASK = /[〇○◯◎●＊*]/;

// ---- 読み込み ----

/** ダブルクォート対応の最小限の CSV パーサ */
function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  if (!head) return [];
  const keys = head.map((h) => h.replace(/^﻿/, "").trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

function readRows(path: string): Row[] {
  const text = readFileSync(path, "utf8");
  if (path.endsWith(".json")) return JSON.parse(text) as Row[];
  if (path.endsWith(".csv")) return parseCsv(text);
  return [];
}

function listFiles(args: string[]): string[] {
  return args.flatMap((a) =>
    statSync(a).isDirectory()
      ? readdirSync(a).filter((f) => /\.(csv|json)$/i.test(f)).map((f) => join(a, f))
      : [a],
  );
}

/** 1行を正規化。URLから女の子ID・都道府県・店舗URLを読み取れないものは捨てる */
/** 2種類の書き出し形式の列名をそろえる */
function col(r: Row, ...keys: string[]): string {
  for (const k of keys) if (r[k] != null) return String(r[k]);
  return "";
}

// 「セクシー女優」一覧以外（店舗の全在籍一覧など）から書き出したファイルでは、
// AV女優である旨の記載がある行だけを扱う（無関係な女性の情報は取り込まない）
const AV_MENTION = /AV|ＡＶ|A[○〇◯]|Ａ[○〇◯]|女優|単体/i;

function toGirl(r: Row): Girl | null {
  const url = col(r, "プロフィールURL", "詳細URL");
  const m = url.match(/^https:\/\/www\.cityheaven\.net\/([a-z]+)\/(A\d+\/A\d+\/[^/]+)\/girlid-(\d+)\/?$/);
  if (!m) return null;
  const prefCode = prefCodeOfSlug(m[1]);
  const displayName = col(r, "女の子名", "嬢名").trim();
  if (!prefCode || !displayName) return null;
  const [rawGenre = "", area = ""] = col(r, "業種・エリア", "業種・地域").split("/");
  return {
    girlId: m[3],
    displayName,
    girlUrl: `${CITYHEAVEN_ORIGIN}/${m[1]}/${m[2]}/girlid-${m[3]}/`,
    shopName: col(r, "所属店舗", "店舗名").trim(),
    shopUrl: `${CITYHEAVEN_ORIGIN}/${m[1]}/${m[2]}/`,
    genre: normalizeGenre(rawGenre),
    area: area.trim(),
    prefCode,
    masked: MASK.test(displayName),
    isAv: !("アピールコメント" in r) || AV_MENTION.test(
      [displayName, col(r, "アピールコメント"), col(r, "セールスポイント"), col(r, "前職"), col(r, "店長からのコメント")].join(" "),
    ),
    schedule: parseSchedule(col(r, "出勤スケジュール")),
  };
}

type Day = { date: string; status: "working" | "off"; start: string | null; end: string | null };

/** 取り込み日から見て一番近い年を補う（年末年始をまたぐ一覧に対応） */
function withYear(month: number, day: number): string {
  const now = new Date(`${todayJst()}T00:00:00+09:00`);
  let y = now.getFullYear();
  const d = new Date(Date.UTC(y, month - 1, day));
  const diff = (d.getTime() - now.getTime()) / 86400_000;
  if (diff < -180) y++;
  else if (diff > 180) y--;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 「9/28(月) 15:00-23:59、10/1(木) 休み、10/2(金)、10/3(土) 13:30-22:00」を日ごとに分ける。
 * 時刻の無い日は、後ろに続く最初の時刻付きの日と同じ時間帯として扱う（店舗の省略表記）。
 */
function parseSchedule(raw: string): Day[] {
  const parts = raw.split(/[、,]/).map((x) => x.trim()).filter(Boolean);
  const days: Day[] = [];
  for (const part of parts) {
    const m = part.match(/^(\d{1,2})\/(\d{1,2})(?:\([^)]*\))?\s*(.*)$/);
    if (!m) continue;
    const date = withYear(Number(m[1]), Number(m[2]));
    const rest = m[3].trim();
    const t = rest.match(/(\d{1,2}:\d{2})\s*[-～~]\s*(\d{1,2}:\d{2})/);
    if (/休/.test(rest)) days.push({ date, status: "off", start: null, end: null });
    else days.push({ date, status: "working", start: t ? t[1] : null, end: t ? t[2] : null });
  }
  // 時刻の省略を後ろから埋める
  let next: Day | null = null;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.status === "off") { next = null; continue; }
    if (d.start) next = d;
    else if (next) { d.start = next.start; d.end = next.end; }
  }
  return days;
}

// ---- 照合（src/lib/ingest/name-match.ts と同じ規則。server-only を避けるためここに置く） ----

function normalizeName(raw: string): string {
  return raw
    .replace(/[【（(\[［].*?[】）)\]］]/g, "")
    .replace(/[☆★♡♥♪◆■※~〜・.,、。]/g, "")
    .replace(/(ちゃん|さん|様)$/, "")
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s+/g, "");
}

type Cand = { actressId: number; name: string; kana: string };
function match(displayName: string, cands: Cand[]): number | null {
  const key = normalizeName(displayName);
  if (key.length < 2) return null;
  const byName = cands.filter((c) => normalizeName(c.name) === key);
  if (byName.length) return byName.length === 1 ? byName[0].actressId : null;
  const byKana = cands.filter((c) => c.kana && normalizeName(c.kana) === key);
  return byKana.length === 1 ? byKana[0].actressId : null;
}

// ---- 本体 ----

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const files = listFiles(args.filter((a) => a !== "--dry-run"));
  if (files.length === 0) {
    console.error("usage: bun --env-file=.env.local scripts/import-thunderbit.ts <file-or-dir> [...] [--dry-run]");
    process.exit(1);
  }

  // 複数ファイルにまたがる重複は女の子IDでまとめる
  const girls = new Map<string, Girl>();
  let skipped = 0, nonAv = 0;
  for (const f of files) {
    for (const r of readRows(f)) {
      const g = toGirl(r);
      if (!g) skipped++;
      else if (!g.isAv) nonAv++;
      else {
        // 同じ女の子が複数ファイルにいる場合、出勤スケジュールのある方を残す
        const prev = girls.get(g.girlId);
        if (prev && g.schedule.length === 0) g.schedule = prev.schedule;
        girls.set(g.girlId, g);
      }
    }
  }

  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });
  const today = todayJst();

  const cands: Cand[] = await db
    .select({ actressId: actresses.id, name: actresses.name, kana: actresses.kana })
    .from(actresses)
    .where(and(eq(actresses.isPublished, true), eq(actresses.optedOut, false)));

  const shopIds = new Map<string, number>();
  async function ensureShop(g: Girl): Promise<number> {
    const key = `${g.prefCode}:${g.shopName}`;
    const hit = shopIds.get(key);
    if (hit) return hit;
    const [found] = await db
      .select({ id: shops.id })
      .from(shops)
      .where(and(eq(shops.name, g.shopName), eq(shops.prefCode, g.prefCode)))
      .limit(1);
    const id =
      found?.id ??
      (await db
        .insert(shops)
        .values({ name: g.shopName, prefCode: g.prefCode, area: g.area, genre: g.genre, officialUrl: g.shopUrl })
        .returning({ id: shops.id }))[0].id;
    shopIds.set(key, id);
    return id;
  }

  const stat = { rows: girls.size, skipped, nonAv, matched: 0, candidates: 0, masked: 0, days: 0 };
  for (const g of girls.values()) {
    const actressId = g.masked ? null : match(g.displayName, cands);
    if (g.masked) stat.masked++;
    if (dryRun) {
      if (actressId) { stat.matched++; stat.days += g.schedule.length; }
      else stat.candidates++;
      continue;
    }
    if (actressId) {
      const shopId = await ensureShop(g);
      const [enr] = await db
        .insert(enrollments)
        .values({
          actressId,
          shopId,
          shopDisplayName: g.displayName,
          sourceUrl: g.girlUrl,
          sourceNote: "シティヘブン「セクシー女優」掲載（ファイル取り込み）",
          verifiedAt: today,
        })
        .onConflictDoUpdate({
          target: [enrollments.actressId, enrollments.shopId],
          set: { shopDisplayName: g.displayName, sourceUrl: g.girlUrl, verifiedAt: today, updatedAt: new Date() },
        })
        .returning({ id: enrollments.id, status: enrollments.status });
      // 運営者が「退店」にした在籍には出勤を入れない。手入力・お店入力の予定は上書きしない
      if (enr.status === "active") {
        for (const d of g.schedule) {
          await db
            .insert(schedules)
            .values({ enrollmentId: enr.id, workDate: d.date, status: d.status, startTime: d.start, endTime: d.end, origin: "ingest" })
            .onConflictDoUpdate({
              target: [schedules.enrollmentId, schedules.workDate],
              set: { status: d.status, startTime: d.start, endTime: d.end, origin: "ingest", updatedAt: new Date() },
              setWhere: eq(schedules.origin, "ingest"),
            });
          stat.days++;
        }
      }
      stat.matched++;
    } else {
      await db
        .insert(candidateGirls)
        .values({
          externalId: g.girlId,
          source: "cityheaven",
          displayName: g.displayName,
          girlUrl: g.girlUrl,
          shopName: g.shopName,
          shopUrl: g.shopUrl,
          prefCode: g.prefCode,
          area: g.area,
          genre: g.genre,
          note: g.masked ? "伏せ字あり：お店が名前を伏せています。推測で女優と結び付けないでください。" : "",
        })
        .onConflictDoUpdate({
          target: [candidateGirls.source, candidateGirls.externalId],
          set: { displayName: g.displayName, shopName: g.shopName, lastSeenAt: new Date() },
        });
      stat.candidates++;
    }
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}files=${files.length} unique=${stat.rows} skipped=${stat.skipped} nonAv=${stat.nonAv} ` +
      `enrolled=${stat.matched} scheduleDays=${stat.days} candidates=${stat.candidates} (masked=${stat.masked})`,
  );
  await client.end();
}

main().catch((e) => {
  console.error("import failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
