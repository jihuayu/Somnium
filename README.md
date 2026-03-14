# Somnium

`Somnium` 是我的个人博客项目，基于 Notion 作为内容后台，使用 Next.js 构建，并可直接部署到 Vercel。

## 项目概览

- 站点名称：Somnium（浮生纪梦）
- 语言：中文（`zh-CN`）
- 评论系统：Utterances
- 数据来源：Notion Data Source（官方 API）
- 技术栈：Next.js 16 + React 18 + Tailwind CSS

## 功能特性

- 在 Notion 中写作，网站自动拉取内容并渲染
- 归档、标签、搜索、RSS、Sitemap
- SEO 配置与 Open Graph 支持
- 响应式布局，支持亮色/暗色/跟随系统

## 本地开发

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local`（或使用 `.env`）：

```bash
NOTION_INTEGRATION_TOKEN=your_notion_integration_token
NOTION_DATA_SOURCE_ID=your_notion_data_source_id
NOTION_ACTIVE_USER=your_notion_user_id
NOTION_PAGE_ID=your_home_page_id
# 可选，不填时默认 2025-09-03
NOTION_API_VERSION=2025-09-03
# 可选：Notion Webhook 首次验证后保存下来的 token
NOTION_WEBHOOK_VERIFICATION_TOKEN=your_notion_webhook_verification_token
```

### 3. 配置站点信息

编辑 `config/blog.config.ts`，重点修改：

- `title` / `author` / `link`
- `description`
- `seo.keywords`
- `comment`（如 Utterances）
- `linkPreview.useOgProxy` / `linkPreview.ogProxyBaseUrl`（开启并指定外部 OG 代理）

### 4. 启动开发服务器

```bash
pnpm dev
```

默认访问：`http://localhost:3000`

## 构建与运行

```bash
pnpm build
pnpm start
```

## 部署到 Vercel

1. 将仓库导入 Vercel
2. 在 Vercel 项目中配置环境变量（与本地一致）
3. 执行部署
4. 后续在 Notion 更新内容后，页面会按 ISR 策略增量更新

## Notion Webhook 刷新缓存

项目提供了一个 Notion Webhook 入口：

```text
POST /api/notion/webhook
```

建议在 Notion 集成的 Webhooks 配置中至少订阅这些事件：

- `page.created`
- `page.properties_updated`
- `page.content_updated`
- `page.deleted`
- `page.undeleted`（不用）
- `data_source.content_updated` （不用）
- `data_source.schema_updated` （如果没有结构变更也不用）
- `data_source.created`
- `data_source.deleted`

首次创建订阅时，Notion 会向这个地址发送一个只包含 `verification_token` 的请求。你需要：

1. 先把 webhook URL 指向站点的 `/api/notion/webhook`
2. 在服务日志中拿到这次请求里的 `verification_token`
3. 把它保存到 `NOTION_WEBHOOK_VERIFICATION_TOKEN`
4. 回到 Notion 集成后台完成 Verify

之后，当 Notion 页面内容、页面属性、Data Source 内容或结构发生变化时，站点会自动刷新相关缓存，包括首页、文章页、分页页、标签页、RSS 和 Tags API。

## 常用脚本

- `pnpm dev`：本地开发
- `pnpm build`：生产构建
- `pnpm start`：生产模式启动
- `pnpm lint`：代码检查

## 项目结构

```text
app/                 Next.js App Router 页面
components/          通用组件
layouts/             页面布局
lib/                 数据获取与工具函数
public/              静态资源
styles/              全局样式
config/              项目配置（如 blog.config.ts、next-sitemap）
next.config.js       Next.js 配置
```

## 致谢

本项目基于 [craigary/nobelium](https://github.com/craigary/nobelium) 二次开发，感谢原作者与社区贡献者。

## License

[MIT](./LICENSE)
