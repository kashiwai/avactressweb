/**
 * オンボーディング表示状態の永続化ヘルパー。
 * LocalStorage を使用 (サーバ側では no-op)。
 */
const KEY_DISMISSED = 'soloptilink:welcome-dismissed';

export const onboardingState = {
  isDismissed(): boolean {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(KEY_DISMISSED) === '1';
  },
  dismiss() {
    if (typeof window === 'undefined') return;
    localStorage.setItem(KEY_DISMISSED, '1');
  },
  reset() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(KEY_DISMISSED);
  },
};
