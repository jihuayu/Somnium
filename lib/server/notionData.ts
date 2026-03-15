import { createNotionClientFromEnv, createNotionDataLayer } from '@jihuayu/notion-react/data'

export const notionClient = createNotionClientFromEnv(process.env)

const notionData = createNotionDataLayer({
  client: notionClient
})

export default notionData