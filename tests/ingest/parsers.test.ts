// 取り込みページの読み取りと名寄せの確認（bun test で実行）
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanDisplayName,
  isPlausibleActressName,
  normalizePersonName,
  normalizePhone,
  normalizeShopName,
  splitAreaGenre,
  splitPersonNames,
} from "../../src/lib/ingest/normalize";
import { matchActressName } from "../../src/lib/ingest/name-match";
import { normalizeImageUrl } from "../../src/lib/images";
import { normalizeGenre } from "../../src/lib/ingest/avzoku";
import { genreLabel } from "../../src/lib/genres";
import { parseAdultinfoActress } from "../../src/lib/ingest/adultinfo";
import { parseFuuavActress, parseFuuavIndex } from "../../src/lib/ingest/fuuav";
import { parseKoukyuderiTable } from "../../src/lib/ingest/koukyuderi";
import { parseAvfuuzokuDetail } from "../../src/lib/ingest/avfuuzoku";
import { parseAvfuzokuActress } from "../../src/lib/ingest/avfuzoku";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "..", "fixtures", name), "utf8");

describe("名前・店名の正規化", () => {
  test("全角/半角・空白・カタカナ/ひらがなをそろえる", () => {
    expect(normalizePersonName("葵 爽")).toBe(normalizePersonName("葵爽"));
    expect(normalizePersonName("ソウ")).toBe(normalizePersonName("そう"));
    expect(normalizePersonName("ＡＩＫＡ")).toBe(normalizePersonName("aika"));
    expect(normalizePersonName("ひなた【S】")).toBe(normalizePersonName("ひなた"));
  });

  test("括弧内・並記の別名を取り出す", () => {
    expect(splitPersonNames("有村のぞみ(早川ひとみ・中井のぞみ)")).toEqual({
      name: "有村のぞみ",
      aliases: ["早川ひとみ", "中井のぞみ"],
    });
    expect(splitPersonNames("千鶴えま(ちづるえま)、サンディー・雛・パークス").name).toBe("千鶴えま");
  });

  test("FC2の品番だけの名前は女優名として扱わない", () => {
    expect(isPlausibleActressName("FC2-PPV-3165655,FC2-PPV-3584064")).toBe(false);
    expect(isPlausibleActressName("一ノ瀬ひとり、FC2-PPV-4837636")).toBe(false);
    expect(isPlausibleActressName("F")).toBe(false);
    expect(isPlausibleActressName("葵爽")).toBe(true);
    expect(isPlausibleActressName("あまね")).toBe(true);
  });

  test("店名は空白・末尾の地域業種の括弧を落として比べる", () => {
    expect(normalizeShopName("Teen’s Luxe 北見店")).toBe(normalizeShopName("Teen’s Luxe北見店"));
    expect(normalizeShopName("ワンダーホール24（千葉県船橋・デリヘル）")).toBe(normalizeShopName("ワンダーホール24"));
  });

  test("地域と業種を分ける", () => {
    expect(normalizeGenre("チャイデリ")).toBe("チャイデリ");
    expect(normalizeGenre("チャイニーズデリヘル")).toBe("チャイデリ");
    expect(genreLabel("風俗エステ")).toBe("エステ");
    expect(splitAreaGenre("千葉県船橋・デリヘル")).toEqual({ area: "千葉県船橋", genre: "デリヘル" });
    expect(splitAreaGenre("渋谷（ホテヘル）")).toEqual({ area: "渋谷", genre: "ホテヘル" });
    expect(splitAreaGenre("都内メンズエステ")).toEqual({ area: "都内", genre: "風俗エステ" });
    expect(normalizePhone("03-6417-9214")).toBe("0364179214");
    expect(cleanDisplayName("HIMARI (22)")).toBe("HIMARI");
  });
});

describe("女優名の照合（別名対応）", () => {
  const candidates = [
    { actressId: 1, name: "有村のぞみ", kana: "ありむらのぞみ", aliases: ["早川ひとみ"] },
    { actressId: 2, name: "葵爽", kana: "あおいそう", aliases: [] },
  ];

  test("別名でも同じ人に結び付ける", () => {
    expect(matchActressName("早川ひとみ", candidates)).toEqual({ kind: "matched", actressId: 1, reason: "別名一致" });
    expect(matchActressName("有村のぞみ(早川ひとみ)", candidates)).toEqual({ kind: "matched", actressId: 1, reason: "氏名一致" });
  });

  test("よみがなでも結び付ける（部分一致はしない）", () => {
    expect(matchActressName("そう", candidates).kind).toBe("unmatched");
    expect(matchActressName("あおいそう", candidates)).toEqual({ kind: "matched", actressId: 2, reason: "よみがな一致" });
  });
});

describe("取り込みページの読み取り", () => {
  test("adultinfo：在籍店情報と過去の在籍（退店）を読む", () => {
    const page = parseAdultinfoActress(fixture("adultinfo-actress.html"), "https://adultinfojpn.com/javstar/amahanoi/");
    expect(page?.name).toBe("天羽のい");
    expect(page?.imageUrl).toBe("https://adultinfojpn.com/wp-content/uploads/2025/10/amahanoi.jpg");
    expect(page?.entries).toHaveLength(5);
    const sendai = page!.entries.find((e) => e.shopName === "シロカノッ！");
    expect(sendai).toMatchObject({ area: "仙台", genre: "デリヘル", prefCode: 4, status: "active", displayName: "天羽のい", verifiedAt: "2026-10-23" });
    const yamanashi = page!.entries.find((e) => e.shopName === "VEGAS");
    expect(yamanashi).toMatchObject({ area: "山梨県甲府", genre: "ソープ", prefCode: 19 });
    const past = page!.entries.find((e) => e.shopName === "風神会館");
    expect(past).toMatchObject({ genre: "ソープ", status: "left" });
  });

  test("fuuav：在籍店一覧と退店一覧を読む", () => {
    const page = parseFuuavActress(fixture("fuuav-actress.html"), "https://fuuav.com/aoiso/");
    expect(page?.name).toBe("葵爽");
    expect(page?.imageUrl).toBe("https://fuuav.com/wp-content/uploads/2026/06/aoiso.webp");
    expect(page?.entries).toHaveLength(3);
    expect(page!.entries[0]).toMatchObject({ shopName: "GINGIRA☆TOKYO", area: "新宿", genre: "デリヘル", prefCode: 13, displayName: "SOU", status: "active" });
    expect(page!.entries[1]).toMatchObject({ shopName: "ワンダーホール24", area: "千葉県船橋", prefCode: 12, displayName: "そう" });
    expect(page!.entries[2]).toMatchObject({ shopName: "ロボットデリヘル", displayName: "アオイ", status: "left" });
  });

  test("fuuav：一覧のページ送りを読む", () => {
    const html = `<ul><li><a href="https://fuuav.com/aoiso/"><h2>「葵爽」風俗店在籍・退店まとめ【AV作品一覧】</h2></a></li></ul>
      <div class="c-pagination"><span class="page-numbers current">1</span><a href="https://fuuav.com/allposts/page/2/" class="page-numbers -to-next">2</a></div>`;
    expect(parseFuuavIndex(html)).toEqual({ actressUrls: ["https://fuuav.com/aoiso/"], nextUrl: "https://fuuav.com/allposts/page/2/" });
  });

  test("コウデリ：表からAV女優名・源氏名・店名・地域・電話を読む", () => {
    const entries = parseKoukyuderiTable(fixture("koukyuderi-table.html"), "https://www.koukyuderi.jp/special/avjoyu.html#t0");
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      actressName: "相河沙季",
      aliases: ["星野なつ"],
      displayName: "現役人妻専属単体女優",
      shopName: "クラブ虎の穴 福岡店",
      area: "福岡",
      prefCode: 40,
      phone: "0927911335",
    });
    expect(entries[1]).toMatchObject({ shopName: "ミセス虎の穴", area: "五反田", prefCode: 13 });
    expect(entries[2]).toMatchObject({ actressName: "愛川すず", displayName: "にじ", shopName: "贅沢なひと時", genre: "ホテヘル" });
  });

  test("avfuuzoku：詳細ページから店名・業種・電話を読む", () => {
    const e = parseAvfuuzokuDetail(fixture("avfuuzoku-detail.html"), "https://avfuuzoku.com/detail.php?id=11405");
    expect(e).toMatchObject({
      actressName: "葵爽",
      displayName: "SOU",
      shopName: "ギンギラ東京",
      genre: "デリヘル",
      area: "新宿",
      prefCode: 13,
      phone: "0362280855",
      status: "active",
    });
  });

  test("avfuzoku：在籍情報のリンクと退店の注記を読む", () => {
    const a = parseAvfuzokuActress(fixture("avfuzoku-actress.html"), "https://www.avfuzoku-soap-deli.com/a-avzyoyu/aidaruka.html");
    expect(a?.name).toBe("愛田るか");
    expect(a?.imageUrl).toBe("https://www.avfuzoku-soap-deli.com/img/202504111437.jpg");
    expect(a?.kana).toBe("あいだるか");
    expect(a?.entries).toHaveLength(2);
    expect(a!.entries[0]).toMatchObject({ shopName: "ミセス東京", area: "吉原", genre: "ソープ", prefCode: 13 });
    expect(a!.entries[1]).toMatchObject({ shopName: "ELITE", area: "雄琴", prefCode: 25 });
    expect(a?.leftShops).toEqual(["プレジデントクラブ"]);
  });
});

describe("女優の写真URL", () => {
  test("httpをhttpsに直し、ダミー画像は使わない", () => {
    expect(normalizeImageUrl("http://img.duga.jp/img/actress/160x160/21854.jpg")).toBe(
      "https://img.duga.jp/img/actress/160x160/21854.jpg",
    );
    expect(normalizeImageUrl(" https://example.com/a.jpg ")).toBe("https://example.com/a.jpg");
    expect(normalizeImageUrl("https://example.com/noimage.png")).toBe("");
    expect(normalizeImageUrl("")).toBe("");
    expect(normalizeImageUrl(null)).toBe("");
  });
});

