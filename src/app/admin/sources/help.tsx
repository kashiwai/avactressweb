import { Card } from "@/components/ui";

export function FeedFormatHelp() {
  return (
    <Card className="p-5 text-sm">
      <h2 className="mb-2 font-bold">JSONフィードの形式（お店にお渡しする仕様）</h2>
      <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs leading-relaxed">{`{
  "schedules": [
    { "cast_name": "店での名前", "date": "2026-09-28", "start": "20:00", "end": "05:00", "status": "working" },
    { "cast_name": "店での名前", "date": "2026-09-29", "status": "off" }
  ]
}`}</pre>
      <p className="mt-2 text-xs text-muted">cast_name が在籍の「店での名前」と完全に一致したものだけ反映します。一致しない名前は自動登録せず「未照合」として記録します。</p>
    </Card>
  );
}
