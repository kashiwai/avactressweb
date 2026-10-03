import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { db } from "@/db";
import { actresses, candidateGirls } from "@/db/schema";
import { actressOptions } from "@/lib/admin-options";
import { prefName } from "@/lib/prefectures";
import { formatDateTimeJst } from "@/lib/dates";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { CandidateRow } from "./row";

export const dynamic = "force-dynamic";

const STATUS = { pending: "確認待ち", linked: "結び付け済み", ignored: "対象外" } as const;

export default async function CandidatesPage({ searchParams }: PageProps<"/admin/candidates">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && sp.status in STATUS ? (sp.status as keyof typeof STATUS) : "pending";
  const [rows, options, counts] = await Promise.all([
    db
      .select({ c: candidateGirls, actressName: actresses.name })
      .from(candidateGirls)
      .leftJoin(actresses, eq(actresses.id, candidateGirls.linkedActressId))
      .where(eq(candidateGirls.status, status))
      .orderBy(status === "pending" ? desc(candidateGirls.lastSeenAt) : desc(candidateGirls.decidedAt), asc(candidateGirls.displayName))
      .limit(300),
    actressOptions(),
    db.select({ status: candidateGirls.status, n: sql<number>`count(*)::int` }).from(candidateGirls).groupBy(candidateGirls.status),
  ]);
  const countOf = (k: keyof typeof STATUS) => counts.find((c) => c.status === k)?.n ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="確認待ちの女の子"
        description="シティヘブンで「セクシー女優」として掲載されている方のうち、源氏名だけでは、どの女優か確定できなかった方の一覧です。"
      />

      <Card className="flex gap-3 p-4 text-sm leading-relaxed">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div>
          <p className="font-bold">ここに並んでいる方は、公開サイトには一切表示されていません。</p>
          <p className="mt-1 text-muted">
            結び付けると、その女優の在籍店舗として公開画面に出ます。<strong className="text-foreground">必ず掲載ページを開いて確認してから</strong>判断してください。
            推測で結び付けると、別人の居場所を公開することになります。判断した方と日時は記録に残ります。
          </p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(STATUS) as Array<keyof typeof STATUS>).map((k) => (
          <Link
            key={k}
            href={`/admin/candidates?status=${k}`}
            className={status === k ? "rounded-lg bg-accent px-3 py-1.5 text-white" : "rounded-lg border border-line px-3 py-1.5 text-muted hover:text-foreground"}
          >
            {STATUS[k]} {countOf(k)}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={status === "pending" ? "確認待ちの方はいません" : `${STATUS[status]}の方はいません`}
          description={status === "pending" ? "シティヘブンの取り込みを実行すると、照合できなかった方がここに並びます。" : undefined}
          action={<LinkButton href="/admin/sources" variant="secondary">取り込み元を見る</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {rows.map(({ c, actressName }) =>
            status === "pending" ? (
              <CandidateRow key={c.id} candidate={c} options={options} />
            ) : (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <span className="font-bold">{c.displayName}</span>
                  <span className="ml-2 text-muted">{c.shopName}／{prefName(c.prefCode)} {c.area}</span>
                  {actressName && <Badge tone="ok" className="ml-2">{actressName}</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{formatDateTimeJst(c.decidedAt)}</span>
                  <a href={c.girlUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-accent underline">
                    掲載ページ <ExternalLink className="size-3" aria-hidden />
                  </a>
                </div>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
