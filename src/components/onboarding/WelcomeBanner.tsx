'use client';

import { useEffect, useState } from 'react';

/**
 * ダッシュボード上部に表示する使い方ガイド。
 * 初回訪問時に自動表示、「閉じる」で LocalStorage に記録して非表示にする。
 *
 * ★重要 (再表示の導線):
 *   閉じたあとも同じ場所に「使い方ガイドを表示」ボタンを残す。
 *   これが無いと、一度閉じたお客様はブラウザの開発者用コンソールで
 *   LocalStorage を操作しないと戻せない = 実質戻せない状態になる。
 *   画面上の操作だけで必ず戻せることを、この分岐で保証する。
 */
export function WelcomeBanner({
  systemName,
  steps,
}: {
  systemName: string;
  steps: { icon: string; title: string; description: string }[];
}) {
  // null = 判定前 (サーバ描画直後)。ここで false を初期値にすると
  // 一瞬だけ再表示ボタンがちらつくため、判定前は何も描かない。
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    const dismissed = typeof window !== 'undefined'
      ? localStorage.getItem('soloptilink:welcome-dismissed') === '1'
      : true;
    setShow(!dismissed);
  }, []);

  const dismiss = () => {
    localStorage.setItem('soloptilink:welcome-dismissed', '1');
    setShow(false);
  };

  const reopen = () => {
    localStorage.removeItem('soloptilink:welcome-dismissed');
    setShow(true);
  };

  if (show === null) return null;

  // 閉じたあとの状態。画面上の操作だけでガイドを戻せるようにする。
  if (!show) {
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={reopen}
          data-testid="welcome-banner-reopen"
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900"
        >
          <span aria-hidden="true">💡</span>
          使い方ガイドを表示
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 dark:from-blue-950 dark:to-indigo-950 dark:border-blue-800">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100">
            🎉 {systemName} へようこそ
          </h2>
          <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
            初めての方は、以下の3ステップで使い方をマスターできます
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          data-testid="welcome-banner-dismiss"
          aria-label="使い方ガイドを閉じる (あとで「使い方ガイドを表示」から戻せます)"
          title="閉じる (あとで「使い方ガイドを表示」から戻せます)"
          className="rounded-md px-2 py-1 text-blue-600 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className="rounded-md border border-blue-200 bg-white/70 p-4 dark:bg-blue-900/30 dark:border-blue-700"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{step.icon}</span>
              <span className="text-sm font-bold text-blue-900 dark:text-blue-100">
                ステップ {i + 1}
              </span>
            </div>
            <h3 className="mt-2 font-semibold text-gray-900 dark:text-gray-100">
              {step.title}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {step.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
        <span>💡</span>
        <span>サンプルデータが事前に投入されているので、すぐに動作確認できます</span>
      </div>
    </div>
  );
}
