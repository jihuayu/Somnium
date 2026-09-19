# AGENTS

## 验证命令

- `pnpm lint`：ESLint（`app/api/og/notion/route.tsx` 的 `no-img-element` warning 是既有的）
- `pnpm test`：Node test runner，覆盖 `tests/` 与 `packages/*/tests/`
- `pnpm run tsdoc:check`：校验 `docs/tsdoc/` 与源码里的 TSDoc 是否同步（只统计带 `/** */` 的导出）
- `npx tsc --noEmit -p tsconfig.json`：主应用类型检查
- `pnpm --filter @jihuayu/notion-vue exec tsc -p tsconfig.build.json --noEmit`：Vue 包类型检查
  （`packages/notion-vue/tsconfig.json` 直接跑会因 `rootDir` 报既有的 TS6059）
- `pnpm run notion:build`：构建 notion-type / notion-data / notion-react
- `pnpm run notion-react:storybook`：Storybook（`localhost:6006`），用 `stories/fixtures.ts` 里的
  假数据，不需要 Notion 凭证，适合验证渲染层交互

## 注意事项

- `pnpm dev` 依赖 `next/font/google`，离线环境下会因为无法访问 `fonts.gstatic.com` 而 500；
  离线时用 Storybook 验证渲染层
- `packages/notion-react`（React）与 `packages/notion-vue`（Vue）是互为镜像的两套实现，
  组件、`NotionRenderer` 分支和 `styles.css` 需要同步改动
