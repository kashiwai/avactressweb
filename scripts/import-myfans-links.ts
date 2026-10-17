// myfans のクリエイター一覧（xlsx / csv / json）から、女優ごとの myfans リンクをまとめて登録する
//
// 使い方: bun --env-file=.env.local scripts/import-myfans-links.ts <ファイルまたはフォルダ> [...] [--dry-run]
//   本番に入れるときは DATABASE_URL に本番の接続先を指定して実行する
//
// 列は見出しから自動で判定する:
//   名前      … 「女優名」「名前」「クリエイター名」など
//   ページURL … myfans.jp のクリエイターページ
//   紹介リンク… 「アフィリエイト」「紹介」「affiliate」などの列（あれば、こちらを優先して使う）
//
// 規則:
//  - 女優名の完全一致で1人に定まったときだけ登録する。同じ名前が複数いる・見つからない行は登録しない
//  - すでに myfans のリンクがある女優は、URLだけ新しいものに更新する（表示名・並び順は変えない）
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const { actresses, affiliateLinks } = schema;
type Row = Record<string, string>;

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

async function parseXlsx(path: string): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const out: Row[] = [];
  wb.eachSheet((ws) => {
    let keys: string[] = [];
    ws.eachRow((r, i) => {
      const vals = (r.values as unknown[]).slice(1).map((v) => {
        if (v && typeof v === "object") {
          const o = v as { text?: string; hyperlink?: string; result?: unknown };
          return String(o.hyperlink ?? o.text ?? o.result ?? "");
        }
        return v == null ? "" : String(v);
      });
      if (i === 1) keys = vals.map((k) => k.trim());
      else out.push(Object.fromEntries(keys.map((k, j) => [k, (vals[j] ?? "").trim()])));
    });
  });
  return out;
}

async function readRows(path: string): Promise<Row[]> {
  if (/\.xlsx$/i.test(path)) return parseXlsx(path);
  const text = readFileSync(path, "utf8");
  if (/\.json$/i.test(path)) return JSON.parse(text) as Row[];
  if (/\.csv$/i.test(path)) return parseCsv(text);
  return [];
}

function listFiles(args: string[]): string[] {
  return args.flatMap((a) =>
    statSync(a).isDirectory() ? readdirSync(a).filter((f) => /\.(xlsx|csv|json)$/i.test(f)).map((f) => join(a, f)) : [a],
  );
}

function pickColumns(sample: Row) {
  const keys = Object.keys(sample);
  const isUrl = (v: string) => /^https?:\/\//i.test(v);
  return {
    name: keys.find((k) => /女優名|名前|クリエイター名|氏名|^name$/i.test(k)),
    affiliate: keys.find((k) => /アフィリ|紹介|affiliate|ref/i.test(k) && isUrl(sample[k] ?? "")),
    page: keys.find((k) => /URL|リンク|ページ|link|profile/i.test(k) && /myfans\.jp\//i.test(sample[k] ?? "")),
  };
}

const norm = (s: string) => s.normalize("NFKC").replace(/[(（][^)）]*[)）]/g, "").replace(/[\s　]/g, "").trim();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const files = listFiles(args.filter((a) => a !== "--dry-run"));
  if (files.length === 0) {
    console.error("usage: bun --env-file=.env.local scripts/import-myfans-links.ts <file-or-dir> [...] [--dry-run]");
    process.exit(1);
  }
  const rows: Row[] = [];
  for (const f of files) rows.push(...(await readRows(f)));
  if (rows.length === 0) { console.error("no rows"); process.exit(1); }
  const cols = pickColumns(rows[0]);
  console.log(`columns: name=${cols.name ?? "-"} page=${cols.page ?? "-"} affiliate=${cols.affiliate ?? "-"}`);
  if (!cols.name || (!cols.page && !cols.affiliate)) { console.error("名前と myfans のURLの列を見つけられませんでした。見出しを確認してください"); process.exit(1); }

  const url = process.env.DATABASE_URL!;
  const client = postgres(url, { max: 1, prepare: !/:6543\//.test(url) });
  const db = drizzle(client, { schema });
  const all = await db.select({ id: actresses.id, name: actresses.name }).from(actresses);
  const byName = new Map<string, number[]>();
  for (const a of all) byName.set(norm(a.name), [...(byName.get(norm(a.name)) ?? []), a.id]);

  const st = { rows: rows.length, created: 0, updated: 0, same: 0, ambiguous: 0, unmatched: 0, noUrl: 0 };
  const done = new Set<number>();
  for (const r of rows) {
    const name = (r[cols.name] ?? "").trim();
    const link = (cols.affiliate && r[cols.affiliate]) || (cols.page && r[cols.page]) || "";
    if (!name) continue;
    if (!/^https?:\/\//i.test(link)) { st.noUrl++; continue; }
    const ids = byName.get(norm(name)) ?? [];
    if (ids.length !== 1) { ids.length > 1 ? st.ambiguous++ : st.unmatched++; continue; }
    const actressId = ids[0];
    if (done.has(actressId)) continue;
    done.add(actressId);
    const [existing] = await db
      .select({ id: affiliateLinks.id, url: affiliateLinks.url })
      .from(affiliateLinks)
      .where(and(eq(affiliateLinks.actressId, actressId), eq(affiliateLinks.provider, "myfans")))
      .limit(1);
    if (existing) {
      if (existing.url === link) { st.same++; continue; }
      if (!dryRun) await db.update(affiliateLinks).set({ url: link }).where(eq(affiliateLinks.id, existing.id));
      st.updated++;
    } else {
      if (!dryRun) await db.insert(affiliateLinks).values({ actressId, provider: "myfans", label: "myfans（無料の投稿あり）", url: link, enabled: true });
      st.created++;
    }
  }
  console.log(`${dryRun ? "[dry-run] " : ""}${JSON.stringify(st)}`);
  await client.end();
}

main().catch((e) => {
  console.error("import failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
