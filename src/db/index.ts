// DB接続（開発時のホットリロードで接続が増えないよう globalThis に保持する）
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };
// Supabase のトランザクション接続（ポート 6543）は事前準備済みの問い合わせに対応しないため無効にする
const isTxPooler = /:6543\//.test(url);
// 1回の問い合わせは15秒まで。詰まったときに画面が何分も固まらず、エラー画面で再試行できるようにする
const client =
  g.__pg ??
  postgres(url, {
    max: isTxPooler ? 1 : 10,
    prepare: !isTxPooler,
    connect_timeout: 10,
    connection: { statement_timeout: 15_000, idle_in_transaction_session_timeout: 30_000 },
  });
if (process.env.NODE_ENV !== "production") g.__pg = client;

export const db = drizzle(client, { schema });
export { schema };
