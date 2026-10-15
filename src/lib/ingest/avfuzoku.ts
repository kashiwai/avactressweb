// avfuzoku-soap-deli.com（運営者の許可を得た取り込み元）のページ読み取り。通信は行わない純粋関数のみ
// 女優ごとのページに「AV女優名」「在籍情報（店名(地域業種) 源氏名 へのリンク）」「退店した店」が載っている。
// 出勤日の情報は無いため、在籍だけを扱う。体験談・口コミ・作品リンク等は読まない。
import { PREFECTURES } from "../prefectures";
import { normalizeGenre } from "./avzoku";
import { prefCodeOfSlug } from "./cityheaven";

export const AVFUZOKU_ORIGIN = "https://www.avfuzoku-soap-deli.com";

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const text = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/** 全記事リスト（sitemap.html）から女優ページのURLを集める（「あ」行〜「わ」行の女優一覧の配下だけ） */
export function parseAvfuzokuIndex(html: string): string[] {
  const urls = new Set<string>();
  const re = /href="(?:\.\/|\/|https:\/\/www\.avfuzoku-soap-deli\.com\/)([a-z]+-avzyoyu?\/[a-z0-9_-]+\.html)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) urls.add(`${AVFUZOKU_ORIGIN}/${m[1]}`);
  return [...urls];
}

/** 風俗街・繁華街の地域名 → 都道府県コード（ページの「(吉原ソープ)」等の地域部分から判定する） */
const AREA_PREF: Array<[RegExp, number]> = [
  [/すすきの|札幌|旭川|函館|帯広|苫小牧|北海道/, 1],
  [/青森|八戸|弘前/, 2], [/盛岡|岩手/, 3], [/仙台|国分町|宮城/, 4], [/秋田/, 5], [/山形/, 6], [/郡山|いわき|福島/, 7],
  [/水戸|土浦|つくば|日立|茨城/, 8], [/宇都宮|小山|栃木/, 9], [/高崎|前橋|太田|伊勢崎|群馬/, 10],
  [/大宮|西川口|川口|浦和|所沢|川越|越谷|熊谷|春日部|草加|本庄|埼玉/, 11],
  [/千葉|栄町|船橋|西船橋|松戸|柏|市川|津田沼|木更津|成田/, 12],
  [/吉原|鶯谷|池袋|新宿|歌舞伎町|渋谷|五反田|品川|上野|御徒町|錦糸町|六本木|赤坂|新橋|銀座|秋葉原|町田|立川|八王子|府中|大塚|巣鴨|蒲田|大森|中野|高田馬場|恵比寿|目黒|日暮里|新小岩|葛西|小岩|北千住|赤羽|東京|Tokyo|TOKYO|青山|表参道|麻布|広尾|神田|有楽町|四谷|飯田橋|水道橋|三軒茶屋|自由が丘|二子玉川|大井町|田町|神楽坂|亀戸|両国|西日暮里|新大久保|大久保|高円寺|荻窪|練馬|板橋|成増|調布|多摩|聖蹟桜ヶ丘|吉祥寺|西東京|都内|浜松町|日本橋\(東京\)/, 13],
  [/川崎|堀之内|横浜|関内|桜木町|曙町|伊勢佐木|厚木|藤沢|相模原|大和|横須賀|小田原|平塚|神奈川/, 14],
  [/新潟|長岡/, 15], [/富山/, 16], [/金沢|片町|石川/, 17], [/福井/, 18], [/甲府|山梨/, 19], [/長野|松本/, 20],
  [/金津園|岐阜/, 21], [/浜松|静岡|沼津|富士|三島/, 22], [/名古屋|栄|錦|名駅|今池|豊橋|岡崎|三河|愛知/, 23], [/四日市|^津$|三重/, 24],
  [/雄琴|大津|草津|彦根|滋賀/, 25], [/京都|祇園|河原町|伏見/, 26],
  [/梅田|難波|なんば|心斎橋|日本橋|十三|谷九|京橋|天王寺|堺|新大阪|大阪/, 27],
  [/神戸|三宮|福原|姫路|尼崎|西宮|明石|加古川|兵庫/, 28], [/奈良|橿原|大和郡山/, 29], [/和歌山/, 30],
  [/鳥取/, 31], [/松江|島根/, 32], [/岡山|倉敷/, 33], [/広島|流川|薬研堀|福山/, 34], [/山口|下関/, 35],
  [/徳島/, 36], [/高松|香川/, 37], [/松山|道後|愛媛/, 38], [/高知/, 39],
  [/博多|中洲|天神|小倉|北九州|久留米|福岡/, 40], [/佐賀/, 41], [/長崎|佐世保/, 42], [/熊本/, 43], [/大分|別府/, 44],
  [/宮崎/, 45], [/鹿児島|天文館/, 46], [/那覇|沖縄|松山\(沖縄\)/, 47],
];

export function prefCodeOfArea(area: string): number | null {
  const byName = PREFECTURES.find((p) => area.includes(p.name.replace(/[都府県]$/, "")));
  for (const [re, code] of AREA_PREF) if (re.test(area)) return code;
  return byName?.code ?? null;
}

/** お店のページのURLから都道府県を読む（シティヘブン等、URLに地域名が入っている場合） */
function prefCodeOfShopUrl(url: string): number | null {
  const m = url.match(/cityheaven\.net\/([a-z]+)\//);
  return m ? prefCodeOfSlug(m[1]) : null;
}

const GENRE_SUFFIX = /(ニューハーフデリヘル|ニューハーフヘルス|メンエス|メンズエステ|ソープランド|ソープ|ホテヘル|ホテルヘルス|デリヘル|デリバリーヘルス|箱ヘル|店舗型ヘルス|ヘルス|M性感|性感エステ|回春エステ|エステ|ピンサロ|SMクラブ|SM|イメクラ|オナクラ|手コキ|待ち合わせ)$/;

export type AvfuzokuEntry = {
  shopName: string;
  area: string;
  genre: string;
  displayName: string;
  shopUrl: string;
  prefCode: number | null;
};

export type AvfuzokuActress = {
  url: string;
  name: string;
  kana: string;
  entries: AvfuzokuEntry[];
  leftShops: string[];
};

/** 「ジャルディーノ(吉原ソープ) 北川まき(PC版)」を店名・地域・業種・源氏名に分ける */
export function parseEntryLabel(label: string): Omit<AvfuzokuEntry, "shopUrl" | "prefCode"> | null {
  const s = label
    .replace(/^[→⇒▶►・\s]+/, "")
    .replace(/\s*[（(]?(PC|SP|スマホ|携帯)版[)）]?\s*$/i, "")
    .trim();
  // 括弧が複数あるとき（「Elise（エリーゼ）(六本木デリヘル) 名前」）は、業種名で終わる括弧を「地域＋業種」とみなす。
  // 見つからなければ最後の括弧を使う。店名のふりがなの括弧を地域と読み違えないため
  const groups = [...s.matchAll(/[(（]([^()（）]+)[)）]/g)];
  if (groups.length === 0) return null;
  const pick = groups.find((g) => GENRE_SUFFIX.test(g[1].trim())) ?? groups[groups.length - 1];
  const shopName = s.slice(0, pick.index).replace(/[(（][^()（）]*[)）]\s*$/, (m) => (groups.indexOf(pick) > 0 ? "" : m)).trim();
  const areaGenre = pick[1].trim();
  const g = areaGenre.match(GENRE_SUFFIX);
  const area = g ? areaGenre.slice(0, -g[0].length).trim() : areaGenre;
  const genre = normalizeGenre(g ? g[0] : areaGenre);
  const displayName = s.slice((pick.index ?? 0) + pick[0].length).trim();
  if (!shopName) return null;
  return { shopName, area, genre, displayName };
}

export function parseAvfuzokuActress(html: string, url: string): AvfuzokuActress | null {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/g, "");
  // 「AV女優名：」の欄が空のページもあるため、本文の見出し（h2）・ページ見出し（h1）の順に補う
  const fromLabel = body.match(/<strong>\s*AV女優名[：:]\s*<\/strong>([^<]*)/)?.[1] ?? "";
  const fromH2 = body.match(/id="text1-section">\s*<h2>([^<]+)<\/h2>/)?.[1] ?? "";
  const fromH1 = (body.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1] ?? "").replace(/の風俗.*$/, "");
  const nameText = [fromLabel, fromH2, fromH1].map((x) => text(x)).find((x) => x.length > 0);
  if (!nameText) return null;
  const nm = nameText.match(/^([^(（]+)(?:[(（]([^)）]+)[)）])?/);
  if (!nm) return null;
  const name = nm[1].trim();
  const kana = (nm[2] ?? "").trim();

  // 「在籍情報」の見出しから、作品紹介の枠（class="point"）までが在籍の欄
  const start = body.search(/<strong>\s*在籍情報\s*<\/strong>/);
  if (start < 0) return { url, name, kana, entries: [], leftShops: [] };
  const rest = body.slice(start);
  const end = rest.search(/<div class="point"|<div class="linkcard"|<h2/);
  const section = end > 0 ? rest.slice(0, end) : rest.slice(0, 8000);

  const entries = new Map<string, AvfuzokuEntry>();
  const re = /<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section))) {
    const shopUrl = decode(m[1]);
    if (!/^https?:\/\//.test(shopUrl) || shopUrl.startsWith(AVFUZOKU_ORIGIN)) continue;
    const e = parseEntryLabel(text(m[2]));
    if (!e) continue;
    const key = `${e.shopName}|${e.area}`;
    if (entries.has(key)) continue; // PC版とSP版の重複
    entries.set(key, { ...e, shopUrl, prefCode: prefCodeOfShopUrl(shopUrl) ?? prefCodeOfArea(e.area) ?? prefCodeOfArea(e.shopName) });
  }

  // 「※A(地域業種)、B(地域業種)は退店しました」
  const leftShops: string[] = [];
  const left = text(section).match(/※([^※]*?)は退店しました/);
  if (left) {
    for (const part of left[1].split(/[、,]/)) {
      const p = parseEntryLabel(part.trim() + " -");
      if (p) leftShops.push(p.shopName);
    }
  }
  return { url, name, kana, entries: [...entries.values()], leftShops };
}
