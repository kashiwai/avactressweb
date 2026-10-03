# tests/a11y/ — アクセシビリティ検査

このディレクトリの spec は SoloptiLinkAI のアクセシビリティゲートが
**雛形として自動生成**したものです。

## 重要: 生成された時点では未実行です

ファイルが在ることは「アクセシビリティが検証済み」という意味ではありません。
実際に検証されるのは、下記の準備をして実行したときだけです。

## 実行の準備

```bash
npm install -D @playwright/test @axe-core/playwright
npx playwright install --with-deps
```

## 実行

```bash
# 既定はトップページのみ
npx playwright test tests/a11y

# 検査する画面を増やす
A11Y_ROUTES=/,/orders,/customers npx playwright test tests/a11y
```

## 内容

| ファイル | 検査 |
|---|---|
| `axe.spec.ts` | axe-core による WCAG 2.1 AA 違反の検出 / 色コントラスト |
| `keyboard.spec.ts` | Tab キーでの到達性 / フォーカス表示の残存 |

自分で書き直して構いません。**既存ファイルが自動上書きされることはありません。**
