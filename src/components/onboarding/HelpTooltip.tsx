'use client';

import { useState } from 'react';

/**
 * 画面要素の脇に置くヒント。クリックで説明をポップオーバーで表示。
 * 例: <HelpTooltip text="顧客の連絡先を登録します" />
 */
export function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="使い方ヒント"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-10 mt-1 w-64 -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
        >
          {text}
          <button
            onClick={() => setOpen(false)}
            className="absolute right-1 top-1 text-gray-400 hover:text-white"
            aria-label="閉じる"
          >
            ✕
          </button>
        </span>
      )}
    </span>
  );
}
