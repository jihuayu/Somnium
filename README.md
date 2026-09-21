# Somnium

`Somnium` 是我的个人博客项目，使用 Atrium 作为公开内容后端、Next.js 负责页面渲染，并可直接部署到 Vercel。

## 项目概览

- 站点名称：Somnium（浮生纪梦）
- 语言：中文（`zh-CN`）
- 评论系统：Atrium
- 数据来源：Atrium Blog API（Notion 同步仅在 Atrium 内部运行）
- 技术栈：Next.js 16 + React 18 + Tailwind CSS

## 功能特性

- 在 Notion 中写作，由 Atrium 同步并向网站提供已发布内容
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
# 必填：Atrium 对外的博客 API 根路径
ATRIUM_BLOG_API_URL=https://atrium.jihuayu.com/api/v1/blog
# 必填：仅用于验证 Atrium 的缓存失效回调，不能在浏览器暴露
CACHE_REVALIDATE_TOKEN=replace_with_a_dedicated_secret
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
3. 在构建和运行环境配置 `ATRIUM_BLOG_API_URL`，并在运行环境配置 `CACHE_REVALIDATE_TOKEN`
4. 执行部署
5. Atrium 提交新内容后，会通知本站立即失效相关页面与数据缓存

## Atrium 缓存失效回调

现有 Notion 订阅保留 `/api/notion/webhook`。Vercel 用原来的 `NOTION_WEBHOOK_VERIFICATION_TOKEN`（也兼容 `NOTION_WEBHOOK_SIGNATURE_SECRET` / `NOTION_WEBHOOK_TOKEN`）验证签名，然后将未经改写的请求体转发到 `${ATRIUM_BLOG_API_URL}/webhooks/notion`。Vercel 不再读取 Notion 数据或提前清缓存；同步、去重和持久化均由 Atrium 完成。

原始 Notion 密钥留在 Vercel。转发签名使用独立用途派生密钥：`HMAC-SHA256(key=CACHE_REVALIDATE_TOKEN, message="somnium:notion-webhook-relay:v1")` 的小写 hex 字符串。把这个派生值配置为 Atrium 的 `NOTION_WEBHOOK_VERIFICATION_TOKEN`。两端必须使用同一个缓存回调密钥；轮换时也要同步更新派生值。它不是原 Notion 密钥，不能直接用于 Notion 到 Atrium 的订阅。不要把这两个密钥输出到日志或提交到仓库。

旧订阅已经验证，不需要重新登记。缺少配置返回 503、错误签名返回 401、请求体上限 1 MiB、上游超时 10 秒。不跟随上游重定向、不转发浏览器 Cookie/Authorization；Atrium 的失败状态和 Retry-After 会返回给 Notion，以保留重试语义。只有 Atrium 确认接收后才返回成功。GET 返回 405。

Atrium 在内容 revision 提交后调用：

```text
POST /api/cache/revalidate
Authorization: Bearer $CACHE_REVALIDATE_TOKEN
```

请求体必须是固定的语义契约，Somnium 不接受调用方指定 cache tag 或路径：

```json
{
  "notificationId": "outbox-uuid",
  "revision": "184",
  "scope": "pages",
  "changes": [
    {
      "pageId": "page-id",
      "oldSlug": "previous-slug",
      "newSlug": "current-slug",
      "kind": "properties"
    }
  ]
}
```

`scope=site` 可带空的 `changes` 数组，用于批量或结构性刷新；较大的变更应使用该 scope 或由 Atrium 拆分通知。成功响应为 `{ "ok": true, "notificationId": "...", "revision": "..." }`。失效失败会返回失败响应，Atrium 必须保留 outbox 项并重试。

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
config/              项目配置（如 blog.config.ts）
next.config.js       Next.js 配置
```

## 致谢

本项目基于 [craigary/nobelium](https://github.com/craigary/nobelium) 二次开发，感谢原作者与社区贡献者。

## License

[MIT](./LICENSE)
