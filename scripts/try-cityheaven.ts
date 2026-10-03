// 保存済みのページで読み取り部品を試すための確認用スクリプト
import { readFileSync } from "node:fs";
import { parseCityheavenList } from "../src/lib/ingest/cityheaven";

const file = process.argv[2] ?? "/tmp/ch_typ27.html";
const r = parseCityheavenList(readFileSync(file, "utf8"), 13);
console.log("総人数:", r.totalCount, "／このページ:", r.girls.length, "人／次ページ:", r.hasNextPage);
console.log("本日出勤:", r.girls.filter((g) => g.workingToday).length, "人");
console.log(JSON.stringify(r.girls.filter((g) => g.workingToday).slice(0, 3), null, 1));
const bad = r.girls.filter((g) => !g.shopName || !g.displayName || !g.prefCode);
console.log("読み取れなかった項目がある件数:", bad.length, bad.slice(0, 2));
