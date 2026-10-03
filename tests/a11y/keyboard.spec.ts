import { test, expect } from '@playwright/test';

/**
 * キーボード操作の到達性検査
 *
 * この雛形は SoloptiLinkAI のアクセシビリティゲートが自動生成しました。
 * 生成された時点では「まだ一度も実行されていない検査枠」です。
 *
 * 検査するURLの追加は環境変数 A11Y_ROUTES (カンマ区切り) で行ってください。
 */
const routes = (process.env.A11Y_ROUTES || '/')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

test.describe('キーボード操作', () => {
  for (const route of routes) {
    test(`${route} の操作要素に Tab で到達できること`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');

      const interactive = await page.locator(
        'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
      ).count();
      test.skip(interactive === 0, '操作要素が無い画面のため対象外');

      const seen = new Set<string>();
      const steps = Math.min(interactive, 30);
      for (let i = 0; i < steps; i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          return {
            key: el.tagName + '#' + (el.id || '') + '.' + (el.className || '') + ':' + (el.textContent || '').slice(0, 20),
            visible: !!el.offsetParent || getComputedStyle(el).position === 'fixed',
          };
        });
        if (focused) {
          expect(focused.visible, 'フォーカスされた要素は画面に見えていなければなりません').toBe(true);
          seen.add(focused.key);
        }
      }

      expect(seen.size, 'Tab でどの操作要素にも到達できませんでした').toBeGreaterThan(0);
    });

    test(`${route} でフォーカス表示が消えていないこと`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      const first = page.locator('a[href], button, input:not([type="hidden"])').first();
      test.skip((await first.count()) === 0, '操作要素が無い画面のため対象外');

      await page.keyboard.press('Tab');
      const hasIndicator = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return true;
        const s = getComputedStyle(el);
        const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth || '0') > 0;
        const ring = s.boxShadow !== 'none' && s.boxShadow !== '';
        return outline || ring;
      });
      expect(hasIndicator, 'フォーカス位置が見た目で分かる必要があります').toBe(true);
    });
  }
});
