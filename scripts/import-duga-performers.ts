// DUGA の女優一覧（duga.jp/main/av/）から書き出した「女優名・写真・女優ページURL」を取り込み、女優の写真を補う
// （画像の利用は DUGA から了承済み）
//
// 使い方: bun --env-file=.env.local scripts/import-duga-performers.ts <ファイルまたはフォルダ> [...] [--dry-run]
//   対応形式: .xlsx / .csv / .json（列は見出しから自動判定）
//   本番に入れるときは DATABASE_URL に本番の接続先を指定して実行する
//
// 規則:
//  - 女優ページのURLに含まれる DUGA の女優番号で紐付ける。無ければ、名前が完全一致で1人に定まる女優に紐付ける
//  - 写真は「空欄」か「作品の表紙（DUGA の jacket 画像）」の女優だけ置き換える。手で登録した写真は上書きしない
//  - サイトに載っていない女優を新しく作ることはしない
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const { actresses } = schema;
type Row = Record<string, string>;

// ---- 読み込み ----
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

// ---- 列の自動判定 ----
function pickColumns(sample: Row): { name?: string; image?: string; url?: string } {
  const keys = Object.keys(sample);
  const find = (re: RegExp, valueRe?: RegExp) =>
    keys.find((k) => re.test(k) && (!valueRe || valueRe.test(sample[k] ?? ""))) ??
    (valueRe ? keys.find((k) => valueRe.test(sample[k] ?? "")) : undefined);
  return {
    name: find(/女優名|名前|氏名|^name$|タイトル|title/i),
    image: find(/画像|写真|image|img|サムネ|photo/i, /^https?:\/\/.+\.(jpe?g|png|webp)/i),
    url: find(/URL|リンク|link|ページ|profile/i, /^https?:\/\/(www\.)?duga\.jp\//i),
  };
}

/** DUGA の女優番号をURLから読む（performerid=22085 / /performer/22085 など） */
function performerIdOf(...urls: string[]): string | null {
  for (const u of urls) {
    const m = u?.match(/performer(?:id)?[=/](\d+)/i);
    if (m) return m[1];
  }
  return null;
}

const norm = (s: string) =>
  s.normalize("NFKC").replace(/[(（][^)）]*[)）]/g, "").replace(/[\s　]/g, "").trim();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const files = listFiles(args.filter((a) => a !== "--dry-run"));
  if (files.length === 0) {
    console.error("usage: bun --env-file=.env.local scripts/import-duga-performers.ts <file-or-dir> [...] [--dry-run]");
    process.exit(1);
  }

  const rows: Row[] = [];
  for (const f of files) rows.push(...(await readRows(f)));
  if (rows.length === 0) { console.error("no rows"); process.exit(1); }
  const cols = pickColumns(rows[0]);
  console.log(`columns: name=${cols.name ?? "-"} image=${cols.image ?? "-"} url=${cols.url ?? "-"}`);
  if (!cols.name || !cols.image) { console.error("名前と画像の列を見つけられませんでした。見出しを確認してください"); process.exit(1); }

  const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: !/:6543\//.test(process.env.DATABASE_URL!) });
  const db = drizzle(client, { schema });
  const all = await db
    .select({ id: actresses.id, name: actresses.name, imageUrl: actresses.imageUrl, dugaPerformerId: actresses.dugaPerformerId })
    .from(actresses);
  const byPid = new Map(all.filter((a) => a.dugaPerformerId).map((a) => [a.dugaPerformerId!, a]));
  const byName = new Map<string, typeof all>();
  for (const a of all) {
    const k = norm(a.name);
    byName.set(k, [...(byName.get(k) ?? []), a]);
  }

  const st = { rows: rows.length, byPid: 0, byName: 0, photoSet: 0, kept: 0, ambiguous: 0, unmatched: 0, noImage: 0 };
  for (const r of rows) {
    const name = (r[cols.name] ?? "").trim();
    const image = (r[cols.image] ?? "").trim();
    if (!name) continue;
    if (!/^https?:\/\/.+\.(jpe?g|png|webp)/i.test(image) || /noimage|dummy|now_printing/i.test(image)) { st.noImage++; continue; }
    const pid = performerIdOf(cols.url ? r[cols.url] : "", image);
    let target = pid ? byPid.get(pid) : undefined;
    if (target) st.byPid++;
    else {
      const cands = byName.get(norm(name)) ?? [];
      if (cands.length === 1) { target = cands[0]; st.byName++; }
      else { cands.length > 1 ? st.ambiguous++ : st.unmatched++; continue; }
    }
    // 写真は空欄か、作品の表紙（DUGA の jacket）だけ置き換える
    const replaceable = !target.imageUrl || /pic\.duga\.jp\/.*\/jacket/i.test(target.imageUrl);
    if (!replaceable) { st.kept++; continue; }
    if (!dryRun) {
      await db
        .update(actresses)
        .set({ imageUrl: image, ...(pid && !target.dugaPerformerId ? { dugaPerformerId: pid } : {}) })
        .where(eq(actresses.id, target.id));
    }
    st.photoSet++;
  }
  console.log(`${dryRun ? "[dry-run] " : ""}${JSON.stringify(st)}`);
  await client.end();
}

main().catch((e) => {
  console.error("import failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
