# notion-data API TSDoc

Generated from source exports with Microsoft TSDoc parser.
基于 Microsoft TSDoc 解析器从源码导出生成。

Total symbols: 29

<a id="resolvablestring-typealiasdeclaration"></a>

## ResolvableString

- Anchor: `resolvablestring-typealiasdeclaration`
- Kind: `TypeAliasDeclaration`
- File: `packages/notion-data/src/data/types/core.ts`
- Summary: EN: Core data structures shared by notion-data modules.ZH: notion-data 各模块共享的核心数据结构。

```ts
/**
 * EN: Core data structures shared by notion-data modules.
 * ZH: notion-data 各模块共享的核心数据结构。
 */
```

<a id="buildnotiondocumentoptions-interfacedeclaration"></a>

## BuildNotionDocumentOptions

- Anchor: `buildnotiondocumentoptions-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-data/src/data/types/document.ts`
- Summary: EN: Options for building normalized Notion documents.ZH: 构建标准化 Notion 文档时的选项。

```ts
/**
 * EN: Options for building normalized Notion documents.
 * ZH: 构建标准化 Notion 文档时的选项。
 */
```

<a id="resolvenotionwebhookoptions-interfacedeclaration"></a>

## ResolveNotionWebhookOptions

- Anchor: `resolvenotionwebhookoptions-interfacedeclaration`
- Kind: `InterfaceDeclaration`
- File: `packages/notion-data/src/data/types/webhook.ts`
- Summary: EN: Generic webhook payload/options/resolution contracts.ZH: 通用 webhook 载荷、选项与解析结果契约。

```ts
/**
 * EN: Generic webhook payload/options/resolution contracts.
 * ZH: 通用 webhook 载荷、选项与解析结果契约。
 */
```

<a id="createnotionclient-functiondeclaration"></a>

## createNotionClient

- Anchor: `createnotionclient-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/client.ts`
- Summary: EN: Creates a Notion API client with retry/backoff and response validation.ZH: 创建带重试/退避与响应校验能力的 Notion API 客户端。

```ts
/**
 * EN: Creates a Notion API client with retry/backoff and response validation.
 * ZH: 创建带重试/退避与响应校验能力的 Notion API 客户端。
 */
```

<a id="createnotionclientfromenv-functiondeclaration"></a>

## createNotionClientFromEnv

- Anchor: `createnotionclientfromenv-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/client.ts`
- Summary: EN: Creates a Notion client from environment variables.ZH: 从环境变量构建 Notion 客户端。

```ts
/**
 * EN: Creates a Notion client from environment variables.
 * ZH: 从环境变量构建 Notion 客户端。
 */
```

<a id="queryalldatasourceentries-functiondeclaration"></a>

## queryAllDataSourceEntries

- Anchor: `queryalldatasourceentries-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/client.ts`
- Summary: EN: Queries and maps all entries from a Notion data source.ZH: 查询并映射指定数据源的全部条目。

```ts
/**
 * EN: Queries and maps all entries from a Notion data source.
 * ZH: 查询并映射指定数据源的全部条目。
 */
```

<a id="buildtextsearchfilter-functiondeclaration"></a>

## buildTextSearchFilter

- Anchor: `buildtextsearchfilter-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/client.ts`
- Summary: EN: Builds a Notion text-search filter object from tokens and clauses.ZH: 基于分词结果与字段子句构造 Notion 文本检索过滤器。

```ts
/**
 * EN: Builds a Notion text-search filter object from tokens and clauses.
 * ZH: 基于分词结果与字段子句构造 Notion 文本检索过滤器。
 */
```

<a id="buildnotiondocument-functiondeclaration"></a>

## buildNotionDocument

- Anchor: `buildnotiondocument-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/document.ts`
- Summary: EN: Builds a normalized Notion document by recursively collecting child blocks.ZH: 递归拉取子块并构建标准化 Notion 文档。

```ts
/**
 * EN: Builds a normalized Notion document by recursively collecting child blocks.
 * ZH: 递归拉取子块并构建标准化 Notion 文档。
 */
```

<a id="normalizenotionuuid-functiondeclaration"></a>

## normalizeNotionUuid

- Anchor: `normalizenotionuuid-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/properties.ts`
- Summary: EN: Normalizes a Notion entity id into canonical UUID format.ZH: 将 Notion 实体 ID 标准化为规范 UUID 形式。

```ts
/**
 * EN: Normalizes a Notion entity id into canonical UUID format.
 * ZH: 将 Notion 实体 ID 标准化为规范 UUID 形式。
 */
```

<a id="getpropertybyname-functiondeclaration"></a>

## getPropertyByName

- Anchor: `getpropertybyname-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/properties.ts`
- Summary: EN: Finds a property by exact/case-insensitive name.ZH: 按精确名或大小写不敏感方式查找属性。

```ts
/**
 * EN: Finds a property by exact/case-insensitive name.
 * ZH: 按精确名或大小写不敏感方式查找属性。
 */
```

<a id="getpropertybynames-functiondeclaration"></a>

## getPropertyByNames

- Anchor: `getpropertybynames-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/properties.ts`
- Summary: EN: Finds the first matched property from multiple candidate names.ZH: 从多个候选字段名中返回首个匹配属性。

```ts
/**
 * EN: Finds the first matched property from multiple candidate names.
 * ZH: 从多个候选字段名中返回首个匹配属性。
 */
```

<a id="readnotiontextproperty-functiondeclaration"></a>

## readNotionTextProperty

- Anchor: `readnotiontextproperty-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/properties.ts`
- Summary: EN: Reads title/rich_text/url property value as plain text.ZH: 读取 title/rich_text/url 类型属性的文本值。

```ts
/**
 * EN: Reads title/rich_text/url property value as plain text.
 * ZH: 读取 title/rich_text/url 类型属性的文本值。
 */
```

<a id="readnotionselectproperty-functiondeclaration"></a>

## readNotionSelectProperty

- Anchor: `readnotionselectproperty-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/properties.ts`
- Summary: EN: Reads select/status property value.ZH: 读取 select/status 类型属性值。

```ts
/**
 * EN: Reads select/status property value.
 * ZH: 读取 select/status 类型属性值。
 */
```

<a id="readnotionmultiselectproperty-functiondeclaration"></a>

## readNotionMultiSelectProperty

- Anchor: `readnotionmultiselectproperty-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/properties.ts`
- Summary: EN: Reads multi-select property values.ZH: 读取 multi_select 类型属性值列表。

```ts
/**
 * EN: Reads multi-select property values.
 * ZH: 读取 multi_select 类型属性值列表。
 */
```

<a id="readnotiondatestartproperty-functiondeclaration"></a>

## readNotionDateStartProperty

- Anchor: `readnotiondatestartproperty-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/properties.ts`
- Summary: EN: Reads date.start from a date property.ZH: 读取 date 类型属性中的 start 字段。

```ts
/**
 * EN: Reads date.start from a date property.
 * ZH: 读取 date 类型属性中的 start 字段。
 */
```

<a id="getpageparentdatasourceid-functiondeclaration"></a>

## getPageParentDataSourceId

- Anchor: `getpageparentdatasourceid-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/properties.ts`
- Summary: EN: Resolves parent data source id from a page parent reference.ZH: 从页面 parent 引用中提取所属数据源 ID。

```ts
/**
 * EN: Resolves parent data source id from a page parent reference.
 * ZH: 从页面 parent 引用中提取所属数据源 ID。
 */
```

<a id="buildpagepathfrompage-functiondeclaration"></a>

## buildPagePathFromPage

- Anchor: `buildpagepathfrompage-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/properties.ts`
- Summary: EN: Builds an internal page path from the page slug property.ZH: 基于页面 slug 属性生成内部路径。

```ts
/**
 * EN: Builds an internal page path from the page slug property.
 * ZH: 基于页面 slug 属性生成内部路径。
 */
```

<a id="finddatasourceproperty-functiondeclaration"></a>

## findDataSourceProperty

- Anchor: `finddatasourceproperty-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/properties.ts`
- Summary: EN: Finds a data source property by candidate names and expected type.ZH: 按候选字段名与期望类型匹配数据源属性。

```ts
/**
 * EN: Finds a data source property by candidate names and expected type.
 * ZH: 按候选字段名与期望类型匹配数据源属性。
 */
```

<a id="resolvedatasourcepropertyrefs-functiondeclaration"></a>

## resolveDataSourcePropertyRefs

- Anchor: `resolvedatasourcepropertyrefs-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/properties.ts`
- Summary: EN: Resolves multiple data source property references by rule map.ZH: 根据规则映射批量解析数据源属性引用。

```ts
/**
 * EN: Resolves multiple data source property references by rule map.
 * ZH: 根据规则映射批量解析数据源属性引用。
 */
```

<a id="tokenizesearchquery-functiondeclaration"></a>

## tokenizeSearchQuery

- Anchor: `tokenizesearchquery-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/properties.ts`
- Summary: EN: Tokenizes search text for building Notion query filters.ZH: 对搜索文本分词，用于构建 Notion 查询过滤器。

```ts
/**
 * EN: Tokenizes search text for building Notion query filters.
 * ZH: 对搜索文本分词，用于构建 Notion 查询过滤器。
 */
```

<a id="buildpagepreviewmap-functiondeclaration"></a>

## buildPagePreviewMap

- Anchor: `buildpagepreviewmap-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/preview.ts`
- Summary: EN: Builds page preview map keyed by page id.ZH: 构建以页面 ID 为键的预览映射。

```ts
/**
 * EN: Builds page preview map keyed by page id.
 * ZH: 构建以页面 ID 为键的预览映射。
 */
```

<a id="mappagetoogdata-functiondeclaration"></a>

## mapPageToOgData

- Anchor: `mappagetoogdata-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/preview.ts`
- Summary: EN: Maps a Notion page to OG-related data.ZH: 将 Notion 页面映射为 OG 所需数据。

```ts
/**
 * EN: Maps a Notion page to OG-related data.
 * ZH: 将 Notion 页面映射为 OG 所需数据。
 */
```

<a id="parsenotionwebhookpayload-functiondeclaration"></a>

## parseNotionWebhookPayload

- Anchor: `parsenotionwebhookpayload-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/webhook/signature.ts`
- Summary: EN: Parses raw webhook body into a structured payload.ZH: 将 webhook 原始请求体解析为结构化载荷。

```ts
/**
 * EN: Parses raw webhook body into a structured payload.
 * ZH: 将 webhook 原始请求体解析为结构化载荷。
 */
```

<a id="isnotionverificationrequest-functiondeclaration"></a>

## isNotionVerificationRequest

- Anchor: `isnotionverificationrequest-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/webhook/signature.ts`
- Summary: EN: Detects Notion verification requests.ZH: 判断是否为 Notion 验证请求。

```ts
/**
 * EN: Detects Notion verification requests.
 * ZH: 判断是否为 Notion 验证请求。
 */
```

<a id="computenotionwebhooksignature-functiondeclaration"></a>

## computeNotionWebhookSignature

- Anchor: `computenotionwebhooksignature-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/webhook/signature.ts`
- Summary: EN: Computes HMAC SHA256 signature for Notion webhook body.ZH: 计算 Notion webhook 请求体的 HMAC SHA256 签名。

```ts
/**
 * EN: Computes HMAC SHA256 signature for Notion webhook body.
 * ZH: 计算 Notion webhook 请求体的 HMAC SHA256 签名。
 */
```

<a id="isvalidnotionwebhooksignature-functiondeclaration"></a>

## isValidNotionWebhookSignature

- Anchor: `isvalidnotionwebhooksignature-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/webhook/signature.ts`
- Summary: EN: Validates webhook signature using timing-safe compare.ZH: 使用时序安全比较校验 webhook 签名。

```ts
/**
 * EN: Validates webhook signature using timing-safe compare.
 * ZH: 使用时序安全比较校验 webhook 签名。
 */
```

<a id="resolvenotionwebhookevent-functiondeclaration"></a>

## resolveNotionWebhookEvent

- Anchor: `resolvenotionwebhookevent-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/webhook/resolver.ts`
- Summary: EN: Resolves webhook payload into generic refresh actions.ZH: 将 webhook 事件解析为通用刷新动作。

```ts
/**
 * EN: Resolves webhook payload into generic refresh actions.
 * ZH: 将 webhook 事件解析为通用刷新动作。
 */
```

<a id="createnotionpluginmanager-functiondeclaration"></a>

## createNotionPluginManager

- Anchor: `createnotionpluginmanager-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/plugins.ts`
- Summary: EN: Creates plugin manager for metadata and webhook extension points.ZH: 创建用于元数据与 webhook 扩展点的插件管理器。

```ts
/**
 * EN: Creates plugin manager for metadata and webhook extension points.
 * ZH: 创建用于元数据与 webhook 扩展点的插件管理器。
 */
```

<a id="createnotiondatalayer-functiondeclaration"></a>

## createNotionDataLayer

- Anchor: `createnotiondatalayer-functiondeclaration`
- Kind: `FunctionDeclaration`
- File: `packages/notion-data/src/data/plugins.ts`
- Summary: EN: Creates a high-level notion-data facade.ZH: 创建 notion-data 的高层能力门面。

```ts
/**
 * EN: Creates a high-level notion-data facade.
 * ZH: 创建 notion-data 的高层能力门面。
 */
```
