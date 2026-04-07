/**
 * EN: Generic webhook payload/options/resolution contracts.
 * ZH: 通用 webhook 载荷、选项与解析结果契约。
 */
export interface ResolveNotionWebhookOptions {
  configuredDataSourceId?: string
  basePath?: string
  resolvePageParentDataSourceId?: (pageId: string) => Promise<string>
  resolvePagePath?: (pageId: string) => Promise<string>
}

export interface NotionWebhookPayload {
  verification_token?: string
  type?: string
  entity?: {
    id?: string
    type?: string
  }
  data?: {
    parent?: {
      id?: string
      type?: string
      data_source_id?: string
      database_id?: string
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface NotionWebhookResolution {
  accepted: boolean
  shouldRefresh: boolean
  isVerificationRequest: boolean
  reason: string
  eventType: string
  entityId: string
  action: 'verification' | 'ignore' | 'home' | 'page' | 'home-and-page' | 'schema' | 'invalid'
  resolvedPagePath: string
}
