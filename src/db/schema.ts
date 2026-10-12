// データベース定義（Drizzle ORM / PostgreSQL）
import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  date,
  time,
  pgEnum,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "shop"]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", ["active", "left"]);
export const scheduleStatusEnum = pgEnum("schedule_status", ["working", "off"]);
export const scheduleOriginEnum = pgEnum("schedule_origin", ["manual", "shop", "ingest"]);
export const sourceKindEnum = pgEnum("source_kind", ["json_feed", "avzoku", "cityheaven", "avfuzoku"]);
export const removalStatusEnum = pgEnum("removal_status", ["new", "in_progress", "done", "rejected"]);
export const requesterEnum = pgEnum("requester_type", ["actress", "agency", "shop", "other"]);
export const linkProviderEnum = pgEnum("link_provider", ["fanza", "myfans", "other"]);
export const candidateStatusEnum = pgEnum("candidate_status", ["pending", "linked", "ignored"]);

// 店舗
export const shops = pgTable(
  "shops",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    prefCode: integer("pref_code").notNull(),
    area: text("area").notNull().default(""),
    genre: text("genre").notNull().default(""),
    officialUrl: text("official_url").notNull().default(""),
    phone: text("phone").notNull().default(""),
    businessHours: text("business_hours").notNull().default(""),
    description: text("description").notNull().default(""),
    // 名前を伏せて在籍しているAV女優の人数（お店が公表している数のみ）
    anonymousAvCount: integer("anonymous_av_count").notNull().default(0),
    anonymousAvSourceUrl: text("anonymous_av_source_url").notNull().default(""),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shops_pref_idx").on(t.prefCode)],
);

// 女優
export const actresses = pgTable(
  "actresses",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    kana: text("kana").notNull().default(""),
    dmmActressId: text("dmm_actress_id"),
    imageUrl: text("image_url").notNull().default(""),
    profile: text("profile").notNull().default(""),
    isPublished: boolean("is_published").notNull().default(true),
    // 本人・事務所からの依頼による掲載停止
    optedOut: boolean("opted_out").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("actresses_name_idx").on(t.name)],
);

// 在籍（女優 × 店舗）。根拠URLは必須
export const enrollments = pgTable(
  "enrollments",
  {
    id: serial("id").primaryKey(),
    actressId: integer("actress_id").notNull().references(() => actresses.id, { onDelete: "cascade" }),
    shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    shopDisplayName: text("shop_display_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceNote: text("source_note").notNull().default(""),
    verifiedAt: date("verified_at", { mode: "string" }).notNull(),
    status: enrollmentStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("enrollments_actress_shop_uq").on(t.actressId, t.shopId),
    index("enrollments_shop_idx").on(t.shopId),
  ],
);

// 出勤（在籍 × 日付で1件）。行が無い日は「未定」
export const schedules = pgTable(
  "schedules",
  {
    id: serial("id").primaryKey(),
    enrollmentId: integer("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    workDate: date("work_date", { mode: "string" }).notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    status: scheduleStatusEnum("status").notNull(),
    origin: scheduleOriginEnum("origin").notNull().default("manual"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("schedules_enrollment_date_uq").on(t.enrollmentId, t.workDate),
    index("schedules_date_idx").on(t.workDate),
  ],
);

// 取り込み元
export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: sourceKindEnum("kind").notNull().default("json_feed"),
  url: text("url").notNull(),
  // JSONフィードは対象店舗が必須。まとめサイト型（avzoku 等）は店舗をページから読み取るため空
  shopId: integer("shop_id").references(() => shops.id, { onDelete: "cascade" }),
  // まとめサイト型で1回に巡回するページ数の上限（日付のページ送り）
  maxPages: integer("max_pages").notNull().default(7),
  enabled: boolean("enabled").notNull().default(false),
  termsConfirmed: boolean("terms_confirmed").notNull().default(false),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastStatus: text("last_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 取り込みの実行履歴
export const ingestRuns = pgTable(
  "ingest_runs",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").notNull().references(() => dataSources.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ok: boolean("ok").notNull().default(false),
    fetchedCount: integer("fetched_count").notNull().default(0),
    appliedCount: integer("applied_count").notNull().default(0),
    unmatchedNames: jsonb("unmatched_names").$type<string[]>().notNull().default([]),
  createdActresses: integer("created_actresses").notNull().default(0),
  createdShops: integer("created_shops").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("ingest_runs_source_idx").on(t.sourceId)],
);

// 取り込みの待ち行列。一覧から集めた女優ページを、実行時間の上限に収まるよう少しずつ処理する
export const queueStatusEnum = pgEnum("queue_status", ["pending", "done", "error"]);
export const ingestQueue = pgTable(
  "ingest_queue",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").notNull().references(() => dataSources.id, { onDelete: "cascade" }),
    runId: integer("run_id").references(() => ingestRuns.id, { onDelete: "set null" }),
    // 取り込み日（日本時間）。同じ日に同じページを2回処理しない
    runDate: date("run_date", { mode: "string" }).notNull(),
    url: text("url").notNull(),
    status: queueStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ingest_queue_source_date_url_uq").on(t.sourceId, t.runDate, t.url),
    index("ingest_queue_status_idx").on(t.status, t.runDate),
  ],
);

// 削除依頼
export const removalRequests = pgTable("removal_requests", {
  id: serial("id").primaryKey(),
  requesterType: requesterEnum("requester_type").notNull(),
  requesterName: text("requester_name").notNull(),
  contact: text("contact").notNull(),
  targetActressId: integer("target_actress_id").references(() => actresses.id, { onDelete: "set null" }),
  targetText: text("target_text").notNull(),
  reason: text("reason").notNull(),
  status: removalStatusEnum("status").notNull().default("new"),
  adminNote: text("admin_note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 女優ごとの外部リンク（myfans・FANZA個別作品など。手動登録）
export const affiliateLinks = pgTable("affiliate_links", {
  id: serial("id").primaryKey(),
  actressId: integer("actress_id").notNull().references(() => actresses.id, { onDelete: "cascade" }),
  provider: linkProviderEnum("provider").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 利用者（運営者・お店）
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  shopId: integer("shop_id").references(() => shops.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // トークンのSHA-256ハッシュ
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 取り込みで見つかったが、どのセクシー女優か確定できなかった女の子
// （運営者が該当ページを見て判断するまで、公開画面には一切出さない）
export const candidateGirls = pgTable(
  "candidate_girls",
  {
    id: serial("id").primaryKey(),
    /** 取り込み元での一意な番号（シティヘブンの女の子ID） */
    externalId: text("external_id").notNull(),
    source: text("source").notNull().default("cityheaven"),
    displayName: text("display_name").notNull(),
    girlUrl: text("girl_url").notNull(),
    shopName: text("shop_name").notNull(),
    shopUrl: text("shop_url").notNull().default(""),
    prefCode: integer("pref_code").notNull(),
    area: text("area").notNull().default(""),
    genre: text("genre").notNull().default(""),
    status: candidateStatusEnum("status").notNull().default("pending"),
    /** 結び付けた女優（判断済みのとき） */
    linkedActressId: integer("linked_actress_id").references(() => actresses.id, { onDelete: "set null" }),
    note: text("note").notNull().default(""),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    decidedBy: integer("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("candidate_girls_source_external_uq").on(t.source, t.externalId),
    index("candidate_girls_status_idx").on(t.status),
  ],
);

// 操作記録（誰がいつ何を変えたか）
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: text("target").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Shop = typeof shops.$inferSelect;
export type Actress = typeof actresses.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type DataSource = typeof dataSources.$inferSelect;
export type User = typeof users.$inferSelect;
export type CandidateGirl = typeof candidateGirls.$inferSelect;

// 定期処理の実行中の札（同じ処理が重なって走らないようにする）
export const jobLeases = pgTable("job_leases", {
  name: text("name").primaryKey(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
});
