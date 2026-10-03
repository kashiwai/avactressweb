// 管理画面の選択肢（女優・店舗）
import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { actresses, shops } from "@/db/schema";

export async function actressOptions() {
  return db.select({ id: actresses.id, name: actresses.name }).from(actresses).orderBy(asc(actresses.kana), asc(actresses.name));
}

export async function shopOptions() {
  return db.select({ id: shops.id, name: shops.name }).from(shops).orderBy(asc(shops.prefCode), asc(shops.name));
}
