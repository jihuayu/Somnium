# notion-type API (EN | 中文)

This page is generated from TSDoc summaries.
本页由 TSDoc 摘要自动生成。

| Symbol | Kind | File | EN | 中文 |
| --- | --- | --- | --- | --- |
| [ValueAdapter](../notion-type.md#valueadapter-interfacedeclaration) | InterfaceDeclaration | packages/notion-type/src/adapters.ts | Generic one-way adapter contract. | 通用的一元适配器契约。 |
| [RenderAdapter](../notion-type.md#renderadapter-interfacedeclaration) | InterfaceDeclaration | packages/notion-type/src/adapters.ts | Generic render adapter contract that accepts input and optional render options. | 通用渲染适配器契约，接收输入与可选渲染参数。 |
| [OgImageDescriptor](../notion-type.md#ogimagedescriptor-interfacedeclaration) | InterfaceDeclaration | packages/notion-type/src/og.ts | Open Graph image descriptor. | Open Graph 图片描述对象。 |
| [NotionOgImageUrlAdapter](../notion-type.md#notionogimageurladapter-interfacedeclaration) | InterfaceDeclaration | packages/notion-type/src/og.ts | Adapter contract for building OG image URLs. | 生成 OG 图片 URL 的适配器契约。 |
| [NotionOpenGraphPayloadAdapter](../notion-type.md#notionopengraphpayloadadapter-interfacedeclaration) | InterfaceDeclaration | packages/notion-type/src/og.ts | Adapter contract for building Open Graph payloads. | 生成 Open Graph 元数据载荷的适配器契约。 |
| [NotionOgAdapter](../notion-type.md#notionogadapter-interfacedeclaration) | InterfaceDeclaration | packages/notion-type/src/og.ts | OG output adapter group. | OG 输出适配器组合。 |
| [ogAdapter](../notion-type.md#ogadapter-firststatement) | FirstStatement | packages/notion-type/src/og.ts | Default OG adapter implementation. | 默认 OG 适配器实现。 |
| [buildOgImageUrl](../notion-type.md#buildogimageurl-functiondeclaration) | FunctionDeclaration | packages/notion-type/src/og.ts | Compatibility wrapper for `ogAdapter.imageUrl.adapt`. | `ogAdapter.imageUrl.adapt` 的兼容包装函数。 |
| [buildOpenGraphPayload](../notion-type.md#buildopengraphpayload-functiondeclaration) | FunctionDeclaration | packages/notion-type/src/og.ts | Compatibility wrapper for `ogAdapter.payload.adapt`. | `ogAdapter.payload.adapt` 的兼容包装函数。 |
| [NotionDocumentHtmlAdapter](../notion-type.md#notiondocumenthtmladapter-interfacedeclaration) | InterfaceDeclaration | packages/notion-type/src/rss.ts | Adapter contract for rendering normalized Notion documents to HTML. | 将标准化 Notion 文档渲染为 HTML 的适配器契约。 |
| [NotionRssFeedAdapter](../notion-type.md#notionrssfeedadapter-interfacedeclaration) | InterfaceDeclaration | packages/notion-type/src/rss.ts | Adapter contract for generating RSS XML. | 生成 RSS XML 的适配器契约。 |
| [NotionRssAdapter](../notion-type.md#notionrssadapter-interfacedeclaration) | InterfaceDeclaration | packages/notion-type/src/rss.ts | RSS output adapter group. | RSS 输出适配器组合。 |
| [rssAdapter](../notion-type.md#rssadapter-firststatement) | FirstStatement | packages/notion-type/src/rss.ts | Default RSS adapter implementation. | 默认 RSS 适配器实现。 |
| [renderNotionDocumentToHtml](../notion-type.md#rendernotiondocumenttohtml-functiondeclaration) | FunctionDeclaration | packages/notion-type/src/rss.ts | Compatibility wrapper for `rssAdapter.documentHtml.render`. | `rssAdapter.documentHtml.render` 的兼容包装函数。 |
| [generateRssFeed](../notion-type.md#generaterssfeed-functiondeclaration) | FunctionDeclaration | packages/notion-type/src/rss.ts | Compatibility wrapper for `rssAdapter.feed.adapt`. | `rssAdapter.feed.adapt` 的兼容包装函数。 |
| [NotionOutputAdapters](../notion-type.md#notionoutputadapters-interfacedeclaration) | InterfaceDeclaration | packages/notion-type/src/output-adapters.ts | Aggregated output adapters for non-render outputs. | 非渲染输出能力的聚合适配器。 |
| [CreateNotionOutputAdaptersOptions](../notion-type.md#createnotionoutputadaptersoptions-interfacedeclaration) | InterfaceDeclaration | packages/notion-type/src/output-adapters.ts | Optional overrides when creating output adapters. | 创建输出适配器时的可选覆盖项。 |
| [defaultNotionOutputAdapters](../notion-type.md#defaultnotionoutputadapters-firststatement) | FirstStatement | packages/notion-type/src/output-adapters.ts | Default output adapters shipped by notion-type. | notion-type 内置的默认输出适配器。 |
| [createNotionOutputAdapters](../notion-type.md#createnotionoutputadapters-functiondeclaration) | FunctionDeclaration | packages/notion-type/src/output-adapters.ts | Creates output adapters with partial module-level overrides. | 创建支持按模块局部覆盖的输出适配器实例。 |
