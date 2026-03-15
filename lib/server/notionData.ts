import { createNotionClientFromEnv, createNotionDataLayer } from '@jihuayu/notion-data'

export const notionClient = createNotionClientFromEnv(process.env)

const notionData = createNotionDataLayer({
  client: notionClient
})

export default notionData