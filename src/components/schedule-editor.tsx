// 出勤表の編集（運営者・お店で共用）。権限の確認はサーバー処理側で行う
import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import type { Schedule } from "@/db/schema";
import { copyPreviousWeek, saveSchedules } from "@/lib/actions/admin";
import { addDays, dateRange, hm, shortDate, todayJst, weekdayIndex } from "@/lib/dates";
import { ActionForm, SubmitButton } from "./client";
import { cn } from "./ui";

export const EDITOR_DAYS = 14;

export function ScheduleEditor({ enrollmentId, from, rows, basePath }: { enrollmentId: number; from: string; rows: Schedule[]; basePath: string }) {
  const dates = dateRange(from, EDITOR_DAYS);
  const byDate = new Map(rows.map((r) => [r.workDate, r]));
  const today = todayJst();
  const sel = "rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link href={`${basePath}?from=${addDays(from, -EDITOR_DAYS)}`} className="rounded-md border border-line p-1.5 text-muted hover:text-foreground" aria-label="前の期間">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="px-2 text-sm font-medium">
            {shortDate(from)} 〜 {shortDate(addDays(from, EDITOR_DAYS - 1))}
          </span>
          <Link href={`${basePath}?from=${addDays(from, EDITOR_DAYS)}`} className="rounded-md border border-line p-1.5 text-muted hover:text-foreground" aria-label="次の期間">
            <ChevronRight className="size-4" />
          </Link>
          {from !== today && (
            <Link href={basePath} className="ml-2 text-xs text-muted underline hover:text-foreground">
              今日から
            </Link>
          )}
        </div>
        <form action={copyPreviousWeek}>
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="from" value={from} />
          <SubmitButton variant="secondary">
            <Copy className="size-4" aria-hidden />
            先週と同じにする
          </SubmitButton>
        </form>
      </div>

      <ActionForm action={saveSchedules} className="space-y-3">
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name="days" value={EDITOR_DAYS} />
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="bg-surface-2 text-xs text-muted">
                <th className="px-3 py-2 text-left">日付</th>
                <th className="px-3 py-2 text-left">状態</th>
                <th className="px-3 py-2 text-left">開始</th>
                <th className="px-3 py-2 text-left">終了</th>
                <th className="px-3 py-2 text-left">登録元</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((d) => {
                const r = byDate.get(d);
                const w = weekdayIndex(d);
                return (
                  <tr key={d} className={cn("border-t border-line", d === today && "bg-accent-soft/40")}>
                    <td className={cn("px-3 py-1.5 font-medium whitespace-nowrap", w === 0 && "text-rose-700", w === 6 && "text-sky-700")}>
                      {shortDate(d)}
                      {d === today && <span className="ml-1 text-xs text-accent">今日</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      <select name={`status_${d}`} defaultValue={r?.status ?? ""} className={sel} aria-label={`${d} の状態`}>
                        <option value="">未定</option>
                        <option value="working">出勤</option>
                        <option value="off">休み</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="time" name={`start_${d}`} defaultValue={hm(r?.startTime)} className={sel} aria-label={`${d} の開始時刻`} />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="time" name={`end_${d}`} defaultValue={hm(r?.endTime)} className={sel} aria-label={`${d} の終了時刻`} />
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted">{r ? { manual: "運営", shop: "お店", ingest: "自動取込" }[r.origin] : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">「未定」にした日は出勤表から消えます。休みの日は時刻を入れなくて構いません。終了が翌日にまたがる場合は、そのまま「05:00」のように入力してください。</p>
        <SubmitButton>出勤を保存する</SubmitButton>
      </ActionForm>
    </div>
  );
}
