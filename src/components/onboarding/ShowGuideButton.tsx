'use client';

import { useRouter } from 'next/navigation';

/**
 * 「使い方ガイドを表示」ボタン。ヘッダーや設定画面に置いて使う。
 * 押すと非表示の記録を消し、ガイドのある画面へ移動する。
 * 画面上の操作だけでガイドを戻せる状態を、どの画面からでも保てるようにする。
 */
export function ShowGuideButton({
  guideHref = '/',
  label = '使い方ガイドを表示',
}: {
  guideHref?: string;
  label?: string;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('soloptilink:welcome-dismissed');
    }
    router.push(guideHref);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid="show-guide-button"
      className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      <span aria-hidden="true">💡</span>
      {label}
    </button>
  );
}

export default ShowGuideButton;
