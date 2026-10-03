import Link from "next/link";
import type { Metadata } from "next";
import { getWorkingCountByPref } from "@/lib/queries";
import { todayJst } from "@/lib/dates";
import { PREFECTURES, REGIONS } from "@/lib/prefectures";
import { Card, PageHeader, cn } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "地域から探す" };

export default async function AreasPage() {
  const counts = await getWorkingCountByPref(todayJst());
  return (
    <div>
      <PageHeader title="地域から探す" description="都道府県を選ぶと、その地域で本日出勤するAV女優が表示されます。数字は本日の出勤人数です。" />
      <div className="grid gap-4 md:grid-cols-2">
        {REGIONS.map((region) => (
          <Card key={region} className="p-4">
            <h2 className="mb-3 font-bold">{region}</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {PREFECTURES.filter((p) => p.region === region).map((p) => {
                const n = counts.get(p.code) ?? 0;
                return (
                  <Link
                    key={p.code}
                    href={`/areas/${p.slug}`}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-center text-sm",
                      n > 0 ? "border-rose-500/40 bg-accent-soft text-rose-800 hover:bg-rose-100" : "border-line text-muted hover:text-foreground",
                    )}
                  >
                    {p.name}
                    <span className="block text-xs">{n > 0 ? `${n}人出勤` : "—"}</span>
                  </Link>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
