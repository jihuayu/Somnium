export interface LinkPreviewData {
  url: string
  hostname: string
  title: string
  description: string
  image: string
  icon: string
}

export type LinkPreviewMap = Record<string, LinkPreviewData>
