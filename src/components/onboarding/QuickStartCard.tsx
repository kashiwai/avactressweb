'use client';

import Link from 'next/link';

/**
 * 「次にやること」を3ボタンで提示するカード。
 * ダッシュボードのサイドバーや空状態 (EmptyState) に配置する想定。
 */
export function QuickStartCard({
  actions,
}: {
  actions: { href: string; label: string; description: string; icon: string }[];
}) {
  return (
    <div className="rounded-lg border bg-white p-5 dark:bg-gray-900 dark:border-gray-800">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        🚀 まずはこちらから
      </h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        次に行うべき操作です
      </p>
      <div className="mt-4 space-y-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-3 rounded-md border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <span className="text-xl">{a.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {a.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {a.description}
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
