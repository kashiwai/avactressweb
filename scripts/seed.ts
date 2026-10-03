// 初期データ投入
//   bun scripts/seed.ts          … 最初の運営者アカウントだけ作る
//   bun scripts/seed.ts --demo   … 動作確認用の架空データも入れる（本番では使わない）
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { addDays, todayJst } from "../src/lib/dates";

const { users, shops, actresses, enrollments, schedules, affiliateLinks } = schema;
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });
const demo = process.argv.includes("--demo");
const credLines: string[] = [];

function genPassword() {
  return randomBytes(12).toString("base64url");
}

async function ensureUser(email: string, role: "admin" | "shop", displayName: string, password: string | undefined, shopId: number | null) {
  const [exists] = await db.select().from(users).where(eq(users.email, email));
  if (exists) {
    console.log(`user exists: ${email}`);
    return;
  }
  const pw = password || genPassword();
  await db.insert(users).values({ email, role, displayName, shopId, passwordHash: await bcrypt.hash(pw, 12) });
  credLines.push(`${role}\t${email}\t${pw}`);
  console.log(`user created: ${email} (${role})`);
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@example.test").toLowerCase();
  await ensureUser(adminEmail, "admin", "運営者", process.env.SEED_ADMIN_PASSWORD, null);

  if (demo) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(shops);
    if (n > 0) {
      console.log("demo skipped: shops already exist");
    } else {
      await seedDemo();
    }
  }

  if (credLines.length) {
    // 生成したパスワードは画面に出さず、Git管理外のファイルに保存する
    writeFileSync(".dev-credentials.txt", `# seed で作成したアカウント（Git管理外・共有しないこと）\nrole\temail\tpassword\n${credLines.join("\n")}\n`, { mode: 0o600, flag: "a" });
    console.log("credentials written to .dev-credentials.txt");
  }
  await client.end();
}

async function seedDemo() {
  const today = todayJst();
  const shopDefs = [
    { name: "見本ラグジュアリー新宿", prefCode: 13, area: "新宿・歌舞伎町", genre: "デリヘル", businessHours: "12:00〜翌5:00", anonymousAvCount: 2 },
    { name: "見本クラブ池袋", prefCode: 13, area: "池袋", genre: "ホテヘル", businessHours: "10:00〜24:00", anonymousAvCount: 0 },
    { name: "見本プレミアム横浜", prefCode: 14, area: "関内", genre: "デリヘル", businessHours: "11:00〜翌3:00", anonymousAvCount: 1 },
    { name: "見本ガーデン梅田", prefCode: 27, area: "梅田", genre: "ホテヘル", businessHours: "10:00〜翌2:00", anonymousAvCount: 0 },
    { name: "見本ロイヤル中洲", prefCode: 40, area: "中洲", genre: "ソープ", businessHours: "9:00〜24:00", anonymousAvCount: 3 },
    { name: "見本スイート栄", prefCode: 23, area: "栄", genre: "デリヘル", businessHours: "12:00〜翌4:00", anonymousAvCount: 0 },
  ];
  const shopRows = await db
    .insert(shops)
    .values(
      shopDefs.map((s, i) => ({
        ...s,
        officialUrl: `https://example.com/shop${i + 1}`,
        phone: `03-0000-000${i}`,
        description: "動作確認用の架空の店舗です。",
        anonymousAvSourceUrl: s.anonymousAvCount ? `https://example.com/shop${i + 1}/cast` : "",
      })),
    )
    .returning();

  const actressDefs = [
    ["星宮みれい（見本）", "ほしみやみれい"],
    ["桜井ひかり（見本）", "さくらいひかり"],
    ["月城あおい（見本）", "つきしろあおい"],
    ["白石ゆな（見本）", "しらいしゆな"],
    ["水瀬かのん（見本）", "みなせかのん"],
    ["朝比奈りこ（見本）", "あさひなりこ"],
    ["花咲まゆ（見本）", "はなさきまゆ"],
    ["七瀬すず（見本）", "ななせすず"],
    ["神崎れな（見本）", "かんざきれな"],
    ["藤原ことね（見本）", "ふじわらことね"],
    ["天音ゆい（見本）", "あまねゆい"],
    ["黒川さら（見本）", "くろかわさら"],
  ];
  const actressRows = await db
    .insert(actresses)
    .values(actressDefs.map(([name, kana]) => ({ name, kana, profile: "動作確認用の架空の女優です。実在の人物とは関係ありません。" })))
    .returning();

  // 女優ごとに1〜2店舗へ在籍
  const pairs: Array<[number, number]> = [];
  actressRows.forEach((a, i) => {
    pairs.push([a.id, shopRows[i % shopRows.length].id]);
    if (i % 3 === 0) pairs.push([a.id, shopRows[(i + 2) % shopRows.length].id]);
  });
  const enrRows = await db
    .insert(enrollments)
    .values(
      pairs.map(([actressId, shopId], i) => {
        const shopIndex = shopRows.findIndex((s) => s.id === shopId);
        const a = actressRows.find((x) => x.id === actressId)!;
        return {
          actressId,
          shopId,
          shopDisplayName: i % 4 === 0 ? a.name.replace("（見本）", "").slice(0, 2) + "（店名）" : a.name,
          sourceUrl: `https://example.com/shop${shopIndex + 1}/cast/${i + 1}`,
          sourceNote: "見本データ",
          verifiedAt: i % 5 === 0 ? addDays(today, -45) : addDays(today, -3),
        };
      }),
    )
    .returning();

  // 過去60日〜先14日の出勤。女優ごとに出勤しやすい曜日を決めて傾向が出るようにする
  const starts = ["12:00", "14:00", "18:00", "20:00"];
  const ends = ["20:00", "22:00", "02:00", "05:00"];
  const rows: Array<typeof schedules.$inferInsert> = [];
  enrRows.forEach((e, idx) => {
    const favorite = [idx % 7, (idx + 3) % 7];
    for (let d = -60; d < 14; d++) {
      const date = addDays(today, d);
      const w = new Date(`${date}T00:00:00Z`).getUTCDay();
      const r = (idx * 31 + d * 17 + 1000) % 10;
      const working = favorite.includes(w) ? r < 8 : r < 2;
      if (d >= 10 && r > 5) continue; // 先の予定はまだ未定の日もある
      const k = (idx + Math.abs(d)) % starts.length;
      rows.push({
        enrollmentId: e.id,
        workDate: date,
        status: working ? "working" : "off",
        startTime: working ? starts[k] : null,
        endTime: working ? ends[k] : null,
        origin: "manual",
      });
    }
  });
  for (let i = 0; i < rows.length; i += 500) await db.insert(schedules).values(rows.slice(i, i + 500));

  // 今日は必ず数人が出勤しているようにする（「いま出勤中」の表示確認用）
  for (const e of enrRows.slice(0, 5)) {
    await db
      .insert(schedules)
      .values({ enrollmentId: e.id, workDate: today, status: "working", startTime: "00:00", endTime: "23:59", origin: "manual" })
      .onConflictDoUpdate({ target: [schedules.enrollmentId, schedules.workDate], set: { status: "working", startTime: "00:00", endTime: "23:59" } });
  }

  await db.insert(affiliateLinks).values({ actressId: actressRows[0].id, provider: "myfans", label: "myfans公式ページ（見本）", url: "https://example.com/myfans", sortOrder: 0 });

  // お店アカウント（見本の1店舗目と2店舗目）
  await ensureUser("shop1@example.test", "shop", "見本ラグジュアリー新宿 担当", undefined, shopRows[0].id);
  await ensureUser("shop2@example.test", "shop", "見本クラブ池袋 担当", undefined, shopRows[1].id);

  console.log(`demo seeded: shops=${shopRows.length} actresses=${actressRows.length} enrollments=${enrRows.length} schedules=${rows.length}`);
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
