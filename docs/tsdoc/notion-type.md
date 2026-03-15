# notion-type API TSDoc

Generated from source exports with Microsoft TSDoc parser.
基于 Microsoft TSDoc 解析器从源码导出生成。

Total symbols: 19

<a id="valueadapter-interfacedeclaration"></a>

## ValueAdapter

- Anchor: `valueadapter-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-type/src/adapters.ts`
- Summary: EN: Generic one-way adapter contract.ZH: 通用的一元适配器契约。

```ts
/**
 * EN: Generic one-way adapter contract.
 * ZH: 通用的一元适配器契约。
 */
```

<a id="renderadapter-interfacedeclaration"></a>

## RenderAdapter

- Anchor: `renderadapter-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-type/src/adapters.ts`
- Summary: EN: Generic render adapter contract that accepts input and optional render options.ZH: 通用渲染适配器契约，接收输入与可选渲染参数。

```ts
/**
 * EN: Generic render adapter contract that accepts input and optional render options.
 * ZH: 通用渲染适配器契约，接收输入与可选渲染参数。
 */
```

<a id="ogimagedescriptor-interfacedeclaration"></a>

## OgImageDescriptor

- Anchor: `ogimagedescriptor-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-type/src/og.ts`
- Summary: EN: Open Graph image descriptor.ZH: Open Graph 图片描述对象。

```ts
/**
 * EN: Open Graph image descriptor.
 * ZH: Open Graph 图片描述对象。
 */
```

<a id="notionogimageurladapter-interfacedeclaration"></a>

## NotionOgImageUrlAdapter

- Anchor: `notionogimageurladapter-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-type/src/og.ts`
- Summary: EN: Adapter contract for building OG image URLs.ZH: 生成 OG 图片 URL 的适配器契约。

```ts
/**
 * EN: Adapter contract for building OG image URLs.
 * ZH: 生成 OG 图片 URL 的适配器契约。
 */
```

<a id="notionopengraphpayloadadapter-interfacedeclaration"></a>

## NotionOpenGraphPayloadAdapter

- Anchor: `notionopengraphpayloadadapter-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-type/src/og.ts`
- Summary: EN: Adapter contract for building Open Graph payloads.ZH: 生成 Open Graph 元数据载荷的适配器契约。

```ts
/**
 * EN: Adapter contract for building Open Graph payloads.
 * ZH: 生成 Open Graph 元数据载荷的适配器契约。
 */
```

<a id="notionogadapter-interfacedeclaration"></a>

## NotionOgAdapter

- Anchor: `notionogadapter-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-type/src/og.ts`
- Summary: EN: OG output adapter group.ZH: OG 输出适配器组合。

```ts
/**
 * EN: OG output adapter group.
 * ZH: OG 输出适配器组合。
 */
```

<a id="ogadapter-firststatement"></a>

## ogAdapter

- Anchor: `ogadapter-firststatement`
- Kind: `FirstStatement`
- File: `packages/notion-type/src/og.ts`
- Summary: EN: Default OG adapter implementation.ZH: 默认 OG 适配器实现。

```ts
/**
 * EN: Default OG adapter implementation.
 * ZH: 默认 OG 适配器实现。
 */
```

<a id="buildogimageurl-functiondeclaration"></a>

## buildOgImageUrl

- Anchor: `buildogimageurl-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-type/src/og.ts`
- Summary: EN: Compatibility wrapper for `ogAdapter.imageUrl.adapt`.ZH: `ogAdapter.imageUrl.adapt` 的兼容包装函数。

```ts
/**
 * EN: Compatibility wrapper for `ogAdapter.imageUrl.adapt`.
 * ZH: `ogAdapter.imageUrl.adapt` 的兼容包装函数。
 */
```

<a id="buildopengraphpayload-functiondeclaration"></a>

## buildOpenGraphPayload

- Anchor: `buildopengraphpayload-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-type/src/og.ts`
- Summary: EN: Compatibility wrapper for `ogAdapter.payload.adapt`.ZH: `ogAdapter.payload.adapt` 的兼容包装函数。

```ts
/**
 * EN: Compatibility wrapper for `ogAdapter.payload.adapt`.
 * ZH: `ogAdapter.payload.adapt` 的兼容包装函数。
 */
```

<a id="notiondocumenthtmladapter-interfacedeclaration"></a>

## NotionDocumentHtmlAdapter

- Anchor: `notiondocumenthtmladapter-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-type/src/rss.ts`
- Summary: EN: Adapter contract for rendering normalized Notion documents to HTML.ZH: 将标准化 Notion 文档渲染为 HTML 的适配器契约。

```ts
/**
 * EN: Adapter contract for rendering normalized Notion documents to HTML.
 * ZH: 将标准化 Notion 文档渲染为 HTML 的适配器契约。
 */
```

<a id="notionrssfeedadapter-interfacedeclaration"></a>

## NotionRssFeedAdapter

- Anchor: `notionrssfeedadapter-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-type/src/rss.ts`
- Summary: EN: Adapter contract for generating RSS XML.ZH: 生成 RSS XML 的适配器契约。

```ts
/**
 * EN: Adapter contract for generating RSS XML.
 * ZH: 生成 RSS XML 的适配器契约。
 */
```

<a id="notionrssadapter-interfacedeclaration"></a>

## NotionRssAdapter

- Anchor: `notionrssadapter-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-type/src/rss.ts`
- Summary: EN: RSS output adapter group.ZH: RSS 输出适配器组合。

```ts
/**
 * EN: RSS output adapter group.
 * ZH: RSS 输出适配器组合。
 */
```

<a id="rssadapter-firststatement"></a>

## rssAdapter

- Anchor: `rssadapter-firststatement`
- Kind: `FirstStatement`
- File: `packages/notion-type/src/rss.ts`
- Summary: EN: Default RSS adapter implementation.ZH: 默认 RSS 适配器实现。

```ts
/**
 * EN: Default RSS adapter implementation.
 * ZH: 默认 RSS 适配器实现。
 */
```

<a id="rendernotiondocumenttohtml-functiondeclaration"></a>

## renderNotionDocumentToHtml

- Anchor: `rendernotiondocumenttohtml-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-type/src/rss.ts`
- Summary: EN: Compatibility wrapper for `rssAdapter.documentHtml.render`.ZH: `rssAdapter.documentHtml.render` 的兼容包装函数。

```ts
/**
 * EN: Compatibility wrapper for `rssAdapter.documentHtml.render`.
 * ZH: `rssAdapter.documentHtml.render` 的兼容包装函数。
 */
```

<a id="generaterssfeed-functiondeclaration"></a>

## generateRssFeed

- Anchor: `generaterssfeed-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-type/src/rss.ts`
- Summary: EN: Compatibility wrapper for `rssAdapter.feed.adapt`.ZH: `rssAdapter.feed.adapt` 的兼容包装函数。

```ts
/**
 * EN: Compatibility wrapper for `rssAdapter.feed.adapt`.
 * ZH: `rssAdapter.feed.adapt` 的兼容包装函数。
 */
```

<a id="notionoutputadapters-interfacedeclaration"></a>

## NotionOutputAdapters

- Anchor: `notionoutputadapters-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-type/src/output-adapters.ts`
- Summary: EN: Aggregated output adapters for non-render outputs.ZH: 非渲染输出能力的聚合适配器。

```ts
/**
 * EN: Aggregated output adapters for non-render outputs.
 * ZH: 非渲染输出能力的聚合适配器。
 */
```

<a id="createnotionoutputadaptersoptions-interfacedeclaration"></a>

## CreateNotionOutputAdaptersOptions

- Anchor: `createnotionoutputadaptersoptions-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-type/src/output-adapters.ts`
- Summary: EN: Optional overrides when creating output adapters.ZH: 创建输出适配器时的可选覆盖项。

```ts
/**
 * EN: Optional overrides when creating output adapters.
 * ZH: 创建输出适配器时的可选覆盖项。
 */
```

<a id="defaultnotionoutputadapters-firststatement"></a>

## defaultNotionOutputAdapters

- Anchor: `defaultnotionoutputadapters-firststatement`
- Kind: `FirstStatement`
- File: `packages/notion-type/src/output-adapters.ts`
- Summary: EN: Default output adapters shipped by notion-type.ZH: notion-type 内置的默认输出适配器。

```ts
/**
 * EN: Default output adapters shipped by notion-type.
 * ZH: notion-type 内置的默认输出适配器。
 */
```

<a id="createnotionoutputadapters-functiondeclaration"></a>

## createNotionOutputAdapters

- Anchor: `createnotionoutputadapters-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-type/src/output-adapters.ts`
- Summary: EN: Creates output adapters with partial module-level overrides.ZH: 创建支持按模块局部覆盖的输出适配器实例。

```ts
/**
 * EN: Creates output adapters with partial module-level overrides.
 * ZH: 创建支持按模块局部覆盖的输出适配器实例。
 */
```
