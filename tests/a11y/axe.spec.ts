import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * アクセシビリティ検査 (WCAG 2.1 AA) — axe-core
 *
 * この雛形は SoloptiLinkAI のアクセシビリティゲートが自動生成しました。
 * 生成された時点では「まだ一度も実行されていない検査枠」です。
 * 実行するには devDependencies に @axe-core/playwright が必要です。
 *
 * 検査するURLの追加:
 *   環境変数 A11Y_ROUTES にカンマ区切りで指定してください。
 *   例) A11Y_ROUTES=/,/orders,/customers npx playwright test
 * 認証が要るページを含める場合は A11Y_STORAGE_STATE に
 * playwright の storageState JSON のパスを渡してください。
 */
const routes = (process.env.A11Y_ROUTES || '/')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

test.describe('アクセシビリティ (WCAG 2.1 AA)', () => {
  for (const route of routes) {
    test(`${route} に重大なアクセシビリティ違反がないこと`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      if (blocking.length > 0) {
        console.log(
          `[a11y] ${route} の違反:`,
          JSON.stringify(
            blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
            null,
            2
          )
        );
      }

      expect(blocking, 'critical / serious の違反は 0 件でなければなりません').toHaveLength(0);
    });

    test(`${route} の色コントラストが AA を満たすこと`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(results.violations).toHaveLength(0);
    });
  }
});
