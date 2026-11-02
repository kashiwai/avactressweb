// DMM の女優検索で、女優の写真と DMM の女優IDを補う（自動実行・管理画面の両方から使う）
// 名前が完全一致で1人に定まったときだけ入れる。同名が複数・見つからない女優は触らない
import "server-only";
import { and, asc, eq, isNotNull, isNull, like, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { actresses } from "@/db/schema";
import { dmmConfigured, searchDmmActress } from "@/lib/dmm";
import { dugaConfigured, performersNamed, searchDuga } from "@/lib/duga";
import { summarizeGenres } from "@/lib/genre-tags";

/** 見つからなかった女優を問い合わせ直すまでの日数（DMM 側に後から登録されることがあるため） */
const RECHECK_DAYS = 30;
const normName = (s: string) => s.replace(/[\s　]/g, "");

export type DmmFillResult = { checked: number; updated: number; ambiguous: number; notFound: number; failed: number; remaining: number };

export async function fillDmmPhotos(deadline: number): Promise<DmmFillResult> {
  const r: DmmFillResult = { checked: 0, updated: 0, ambiguous: 0, notFound: 0, failed: 0, remaining: 0 };
  if (!dmmConfigured()) return r;
  const due = and(
    isNull(actresses.dmmActressId),
    or(isNull(actresses.dmmCheckedAt), lt(actresses.dmmCheckedAt, new Date(Date.now() - RECHECK_DAYS * 86400_000))),
  );
  while (Date.now() < deadline) {
    const batch = await db
      .select({ id: actresses.id, name: actresses.name, imageUrl: actresses.imageUrl })
      .from(actresses)
      .where(due)
      .orderBy(sql`${actresses.dmmCheckedAt} asc nulls first`, asc(actresses.id))
      .limit(20);
    if (batch.length === 0) break;
    for (const t of batch) {
      if (Date.now() > deadline) break;
      const res = await searchDmmActress(t.name);
      r.checked++;
      if (!res.ok) {
        // 通信失敗は「問い合わせ済み」にしない（次の実行でもう一度試す）
        r.failed++;
        if (r.failed >= 5) return { ...r, remaining: await countDue(due) };
        continue;
      }
      const exact = res.items.filter((i) => normName(i.name) === normName(t.name));
      if (exact.length === 1) {
        // 写真が空欄か作品の表紙（DUGA の jacket）のときだけ、DMM の女優写真に置き換える
        const replaceable = !t.imageUrl || /pic\.duga\.jp\/.*\/jacket/i.test(t.imageUrl) || /noimage|now_printing/i.test(t.imageUrl);
        await db
          .update(actresses)
          .set({ dmmActressId: exact[0].id, imageUrl: replaceable ? exact[0].imageUrl || t.imageUrl : t.imageUrl, dmmCheckedAt: new Date() })
          .where(eq(actresses.id, t.id));
        r.updated++;
      } else {
        await db.update(actresses).set({ dmmCheckedAt: new Date() }).where(eq(actresses.id, t.id));
        if (exact.length > 1) r.ambiguous++;
        else r.notFound++;
      }
      await new Promise((ok) => setTimeout(ok, 1100)); // 1秒に1件程度に抑える
    }
  }
  return { ...r, remaining: await countDue(due) };
}

async function countDue(due: ReturnType<typeof and>): Promise<number> {
  const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(actresses).where(due);
  return c?.n ?? 0;
}

// ---- DUGA：女優番号の紐付けと、写真（その女優が1人で出ている作品の表紙）の補完 ----
// 同じ名前で別人が複数いる場合は紐付けない。写真は、すでに入っている場合は上書きしない

/** DUGA の女優の顔写真（160x160）。画像が無い女優は 404 が返る */
export async function dugaFaceCheck(performerId: string): Promise<{ ok: boolean; url: string | null }> {
  if (!/^\d+$/.test(performerId)) return { ok: true, url: null };
  const url = `https://img.duga.jp/img/actress/160x160/${performerId}.jpg`;
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(8000) });
    // 404 は「顔写真が無い」、それ以外の失敗（429等）は次の実行でやり直す
    if (res.status === 404) return { ok: true, url: null };
    if (!res.ok) return { ok: false, url: null };
    const type = res.headers.get("content-type") ?? "";
    return { ok: true, url: type.startsWith("image/") ? url : null };
  } catch {
    return { ok: false, url: null };
  }
}

/** 顔写真のURL（無いとき・確認できないときは null） */
export async function dugaFaceUrl(performerId: string): Promise<string | null> {
  return (await dugaFaceCheck(performerId)).url;
}

export type DugaFillResult = { checked: number; linked: number; photos: number; ambiguous: number; notFound: number; failed: number; remaining: number };

export async function fillDugaPhotos(deadline: number): Promise<DugaFillResult> {
  const r: DugaFillResult = { checked: 0, linked: 0, photos: 0, ambiguous: 0, notFound: 0, failed: 0, remaining: 0 };
  if (!dugaConfigured()) return r;
  const stale = new Date(Date.now() - RECHECK_DAYS * 86400_000);
  const replaceable = or(eq(actresses.imageUrl, ""), like(actresses.imageUrl, "%pic.duga.jp/%/jacket%"));
  const due = or(
    // まだ DUGA の女優番号が分かっていない人（30日に1回まで）
    and(isNull(actresses.dugaPerformerId), or(isNull(actresses.dugaCheckedAt), lt(actresses.dugaCheckedAt, stale))),
    // 紐付け済みでも、写真が空欄・作品の表紙のままなら顔写真に置き換える（30日に1回まで）
    and(isNotNull(actresses.dugaPerformerId), replaceable, or(isNull(actresses.dugaCheckedAt), lt(actresses.dugaCheckedAt, stale))),
  );
  while (Date.now() < deadline) {
    const batch = await db
      .select({ id: actresses.id, name: actresses.name, imageUrl: actresses.imageUrl, pid: actresses.dugaPerformerId })
      .from(actresses)
      .where(due)
      .orderBy(sql`${actresses.dugaCheckedAt} asc nulls first`, asc(actresses.id))
      .limit(20);
    if (batch.length === 0) break;
    for (const t of batch) {
      if (Date.now() > deadline) break;
      // すでに女優番号が分かっているときは、検索せず顔写真の有無だけ確認する
      if (t.pid) {
        const face = await dugaFaceCheck(t.pid);
        if (face.url) {
          await db.update(actresses).set({ imageUrl: face.url, dugaCheckedAt: new Date() }).where(eq(actresses.id, t.id));
          r.photos++;
        } else if (face.ok) {
          // 顔写真が無いと確認できたときだけ「確認済み」にする（通信失敗は次の実行でやり直す）
          await db.update(actresses).set({ dugaCheckedAt: new Date() }).where(eq(actresses.id, t.id));
        } else {
          r.failed++;
        }
        r.checked++;
        await new Promise((ok) => setTimeout(ok, 500));
        continue;
      }
      const res = await searchDuga(t.name, { hits: 50, sort: "favorite", cache: "none" });
      r.checked++;
      if (!res.ok) {
        r.failed++;
        if (r.failed >= 5) return { ...r, remaining: await countDue(due) };
        continue;
      }
      const found = performersNamed(res.items, t.name);
      if (found.length === 1) {
        const pid = found[0].id;
        // 写真が空欄か、作品の表紙（DUGA の jacket）のときだけ置き換える。手で入れた写真は上書きしない
        const canReplace = !t.imageUrl || /pic\.duga\.jp\/.*\/jacket/i.test(t.imageUrl);
        // その女優だけが出演している作品の表紙を写真にする（複数人の作品は別人が写るため使わない）
        // 写真は、DUGA の顔写真を優先し、無ければ1人出演作品の表紙にする
        const faceCheck = canReplace ? await dugaFaceCheck(pid) : { ok: true, url: null };
        const face = faceCheck.url;
        const solo = face ? undefined : res.items.find((it) => it.performers.length === 1 && it.performers[0].id === pid && (it.jacketUrl || it.posterUrl));
        const photo = face ?? (solo ? solo.jacketUrl || solo.posterUrl : "");
        // 同じ検索結果から、その女優の出演作品のジャンルも集める（追加の問い合わせはしない）
        const genres = summarizeGenres(res.items.filter((it) => it.performers.some((p) => p.id === pid)).map((it) => it.categories));
        await db
          .update(actresses)
          .set({
            dugaPerformerId: pid,
            imageUrl: canReplace ? photo || t.imageUrl : t.imageUrl,
            genres,
            // 顔写真の確認が通信エラーだったときは、次の実行でもう一度試す
            dugaCheckedAt: faceCheck.ok ? new Date() : null,
          })
          .where(eq(actresses.id, t.id));
        r.linked++;
        if (canReplace && photo) r.photos++;
      } else {
        await db.update(actresses).set({ dugaCheckedAt: new Date() }).where(eq(actresses.id, t.id));
        if (found.length > 1) r.ambiguous++;
        else r.notFound++;
      }
      await new Promise((ok) => setTimeout(ok, 1100)); // 60秒に60回までの制限に収める
    }
  }
  return { ...r, remaining: await countDue(due) };
}

/**
 * DUGA と紐付き済みで、ジャンルがまだ無い女優のジャンルを集める（紐付けより前に入った女優の分）。
 * ジャンルが1つも見つからなかった女優は「その他」を入れて、毎回問い合わせ直さないようにする
 */
export async function fillDugaGenres(deadline: number): Promise<{ checked: number; filled: number; remaining: number }> {
  const r = { checked: 0, filled: 0, remaining: 0 };
  if (!dugaConfigured()) return r;
  const due = and(isNotNull(actresses.dugaPerformerId), sql`${actresses.genres} = '[]'::jsonb`);
  while (Date.now() < deadline) {
    const batch = await db
      .select({ id: actresses.id, name: actresses.name, pid: actresses.dugaPerformerId })
      .from(actresses)
      .where(due)
      .orderBy(asc(actresses.id))
      .limit(20);
    if (batch.length === 0) break;
    for (const t of batch) {
      if (Date.now() > deadline) break;
      const res = await searchDuga(t.name, { hits: 50, sort: "favorite", cache: "none" });
      r.checked++;
      if (!res.ok) return { ...r, remaining: await countDue(due) };
      const genres = summarizeGenres(res.items.filter((it) => it.performers.some((p) => p.id === t.pid)).map((it) => it.categories));
      await db.update(actresses).set({ genres: genres.length ? genres : ["その他"] }).where(eq(actresses.id, t.id));
      if (genres.length) r.filled++;
      await new Promise((ok) => setTimeout(ok, 1100));
    }
  }
  return { ...r, remaining: await countDue(due) };
}
