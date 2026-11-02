// 実際のページを読んで、取り込みの読み取りが動いているかを確認する（書き込みはしない）
// 使い方: bun --env-file=.env.local scripts/check-ingest-pages.ts
import { parseAvzokuActress, parseAvzokuList } from "../src/lib/ingest/avzoku";
import { parseAvfuzokuActress, parseAvfuzokuIndex } from "../src/lib/ingest/avfuzoku";
import { parseAdultinfoActress, parseAdultinfoIndex } from "../src/lib/ingest/adultinfo";
import { parseFuuavActress, parseFuuavIndex } from "../src/lib/ingest/fuuav";
import { countKoukyuderiTables, parseKoukyuderi } from "../src/lib/ingest/koukyuderi";
import { parseAvfuuzokuDetail, parseAvfuuzokuIndex } from "../src/lib/ingest/avfuuzoku";
import { todayJst } from "../src/lib/dates";

const UA = { "User-Agent": "AVShukkinNaviBot/1.0 (+schedule aggregator; contact via site)" };
const get = async (url: string) => {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = todayJst();
const ok = (label: string, n: number, extra = "") => console.log(`${n > 0 ? "OK " : "NG "} ${label}: ${n}件 ${extra}`);

const avzokuList = parseAvzokuList(await get("https://avzoku.com/schedule/tokyo-deliveryhealth/"));
ok("avzoku 一覧", avzokuList.actressUrls.length, avzokuList.nextUrl ?? "");
if (avzokuList.actressUrls[0]) {
  const a = parseAvzokuActress(await get(avzokuList.actressUrls[0]), avzokuList.actressUrls[0], today);
  ok("avzoku 女優ページ", a ? 1 : 0, a ? `${a.name}/${a.shopName}/${a.schedules.length}日` : "");
}
await sleep(1000);

const avfIdx = parseAvfuzokuIndex(await get("https://www.avfuzoku-soap-deli.com/sitemap.html"));
ok("avfuzoku 一覧", avfIdx.length);
let avfWith = 0;
for (const u of avfIdx.slice(0, 12)) {
  const a = parseAvfuzokuActress(await get(u), u);
  if (a?.entries.length) avfWith++;
  await sleep(700);
}
ok("avfuzoku 女優ページ（12件中、在籍あり）", avfWith);

const aijIdx = parseAdultinfoIndex(await get("https://adultinfojpn.com/avfuzoku/"));
ok("adultinfo 一覧", aijIdx.length);
let aijEntries = 0;
for (const u of aijIdx.slice(0, 6)) {
  const a = parseAdultinfoActress(await get(u), u);
  aijEntries += a?.entries.length ?? 0;
  await sleep(700);
}
ok("adultinfo 女優ページ（6件の在籍合計）", aijEntries);

const fuuIdx = parseFuuavIndex(await get("https://fuuav.com/allposts/"));
ok("FuuAV 一覧", fuuIdx.actressUrls.length, fuuIdx.nextUrl ?? "");
if (fuuIdx.actressUrls[0]) {
  const a = parseFuuavActress(await get(fuuIdx.actressUrls[0]), fuuIdx.actressUrls[0]);
  ok("FuuAV 女優ページ", a?.entries.length ?? 0, a?.name ?? "");
}
await sleep(1000);

const kou = await get("https://www.koukyuderi.jp/special/avjoyu.html");
ok("コウデリ 表", countKoukyuderiTables(kou));
ok("コウデリ 1表目の在籍", parseKoukyuderi(kou, "https://www.koukyuderi.jp/special/avjoyu.html", 0).length);

const avfzIdx = parseAvfuuzokuIndex(await get("https://avfuuzoku.com/genre_search.php"));
ok("avfuuzoku 詳細一覧", avfzIdx.length);
let avfzOne = null;
for (const u of avfzIdx.slice(0, 8)) {
  avfzOne = parseAvfuuzokuDetail(await get(u), u);
  if (avfzOne) break;
  await sleep(600);
}
ok("avfuuzoku 詳細ページ", avfzOne ? 1 : 0, avfzOne ? `${avfzOne.actressName}/${avfzOne.shopName}/${avfzOne.genre}/${avfzOne.area}` : "");
