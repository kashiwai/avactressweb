#!/bin/zsh
# 毎日の更新（macOS / launchd から呼ぶ用）
#   ingest（待ち行列の続き）→ 店ページのシフト同期 → 画像の不足分 → 重複整理
set -uo pipefail
cd "$(dirname "$0")/.."

# 本番DBの接続先（.env.supabase.local の SUPABASE_SESSION_URL）を使う
set -a
source ./.env.supabase.local
set +a
export DATABASE_URL="$SUPABASE_SESSION_URL"
export TZ=Asia/Tokyo

BUN="${BUN:-$(command -v bun)}"
if [ -z "$BUN" ]; then
  echo "bun が見つかりません" >&2
  exit 1
fi

# 二重起動を防ぐ（前回が長引いた場合はスキップ）
LOCK="/tmp/adlutweb-daily.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "既に実行中です（$LOCK）"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z') 開始 ==="
"$BUN" --env-file=.env.local --conditions=react-server scripts/ingest-now.ts || echo "ingest: 失敗（続行）"
"$BUN" --env-file=.env.local --conditions=react-server scripts/sync-shop-shifts.ts --apply || echo "shifts: 失敗（続行）"
"$BUN" --env-file=.env.local --conditions=react-server scripts/backfill-photos.ts --apply --missing-only --skip-api || echo "photos: 失敗（続行）"
"$BUN" --env-file=.env.local --conditions=react-server scripts/clean-merge.ts --apply || echo "merge: 失敗（続行）"
echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z') 完了 ==="
