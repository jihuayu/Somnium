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
- 支持 Google Analytics

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
```

### 3. 配置站点信息

编辑 `blog.config.js`，重点修改：

- `title` / `author` / `link`
- `description`
- `seo.keywords`
- `analytics`（如 GA）
- `comment`（如 Utterances）

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
blog.config.js       博客核心配置
next.config.js       Next.js 配置
```

## 致谢

本项目基于 [craigary/nobelium](https://github.com/craigary/nobelium) 二次开发，感谢原作者与社区贡献者。

## License

[MIT](./LICENSE)
