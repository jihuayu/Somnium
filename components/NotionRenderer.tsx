'use client'

import { Fragment } from 'react'
import cn from 'classnames'
import { FONTS_SANS, FONTS_SERIF } from '@/consts'
import { useConfig } from '@/lib/config'
import LinkPreviewCard from '@/components/LinkPreviewCard'
import type { NotionDocument } from '@/lib/notion/getPostBlocks'

function getPlainTextFromRichText(richText: any[] = []): string {
  return richText.map(item => item?.plain_text || '').join('')
}

function getBlockClassName(blockId: string): string {
  return `notion-block-${blockId.replaceAll('-', '')}`
}

function getEmbedUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace('www.', '')
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host.includes('youtube.com')) {
      const id = parsed.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
      if (parsed.pathname.startsWith('/embed/')) return url
    }
  } catch {
    return null
  }
  return null
}

function RichText({ richText = [] }: { richText: any[] }) {
  if (!richText.length) return null
  return (
    <>
      {richText.map((item: any, index: number) => {
        const textContent = item?.type === 'equation'
          ? item?.equation?.expression || ''
          : item?.plain_text || ''
        const href = item?.href || item?.text?.link?.url || null
        const annotations = item?.annotations || {}

        const content = (
          <span
            className={cn(
              annotations.bold && 'font-semibold',
              annotations.italic && 'italic',
              annotations.strikethrough && 'line-through',
              annotations.underline && 'underline',
              annotations.code &&
                'font-mono text-[0.9em] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800'
            )}
          >
            {textContent}
          </span>
        )

        if (!href) {
          return <Fragment key={`${index}-${textContent}`}>{content}</Fragment>
        }

        return (
          <a
            key={`${index}-${href}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline underline-offset-4"
          >
            {content}
          </a>
        )
      })}
    </>
  )
}

interface NotionRendererProps {
  document: NotionDocument | null
}

export default function NotionRenderer({ document }: NotionRendererProps) {
  const config = useConfig()
  const font = {
    'sans-serif': FONTS_SANS,
    serif: FONTS_SERIF
  }[config?.font] || FONTS_SANS

  if (!document) return null

  const blocksById = document.blocksById || {}
  const childrenById = document.childrenById || {}
  const rootIds = document.rootIds || []

  const renderChildren = (blockId: string) => {
    const childIds = childrenById[blockId] || []
    if (!childIds.length) return null
    return renderBlockList(childIds)
  }

  const renderBulletedListItem = (block: any) => {
    const richText = block?.bulleted_list_item?.rich_text || []
    const className = getBlockClassName(block.id)
    return (
      <li key={block.id} className={className}>
        <div className="notion-text whitespace-pre-wrap">
          <RichText richText={richText} />
        </div>
        {renderChildren(block.id)}
      </li>
    )
  }

  const renderColumnBlock = (block: any) => {
    const className = getBlockClassName(block.id)
    const flex = block?.column?.width_ratio || 1
    return (
      <div key={block.id} className={className} style={{ flex, minWidth: 0 }}>
        {renderChildren(block.id)}
      </div>
    )
  }

  const renderBlock = (block: any): React.ReactNode => {
    if (!block?.id) return null
    const className = getBlockClassName(block.id)

    switch (block.type) {
      case 'paragraph': {
        const richText = block?.paragraph?.rich_text || []
        return (
          <div key={block.id} className={className}>
            {richText.length > 0 && (
              <p className="notion-text whitespace-pre-wrap">
                <RichText richText={richText} />
              </p>
            )}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'heading_1':
      case 'heading_2':
      case 'heading_3': {
        const richText = block?.[block.type]?.rich_text || []
        const headingClass = cn(
          'font-semibold text-black dark:text-white scroll-mt-20',
          block.type === 'heading_1' && 'text-3xl mt-10 mb-4',
          block.type === 'heading_2' && 'text-2xl mt-8 mb-3',
          block.type === 'heading_3' && 'text-xl mt-7 mb-3'
        )
        const headingNode = block.type === 'heading_1'
          ? <h1 className={headingClass}><RichText richText={richText} /></h1>
          : block.type === 'heading_2'
            ? <h2 className={headingClass}><RichText richText={richText} /></h2>
            : <h3 className={headingClass}><RichText richText={richText} /></h3>
        return (
          <div key={block.id} className={className}>
            {headingNode}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'quote': {
        const richText = block?.quote?.rich_text || []
        return (
          <div key={block.id} className={className}>
            <blockquote className="notion-quote border-l-4 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-r-md whitespace-pre-wrap">
              <RichText richText={richText} />
            </blockquote>
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'bulleted_list_item':
        return renderBulletedListItem(block)
      case 'code': {
        const code = block?.code || {}
        const source = getPlainTextFromRichText(code.rich_text || [])
        return (
          <div key={block.id} className={className}>
            <div className="rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-zinc-50 dark:bg-zinc-900/40 my-4">
              {code.language && (
                <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                  {code.language}
                </div>
              )}
              <pre className="overflow-x-auto p-3 text-sm text-zinc-900 dark:text-zinc-100">
                <code>{source}</code>
              </pre>
            </div>
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'image': {
        const image = block?.image || {}
        const source = image.type === 'external'
          ? image?.external?.url
          : image?.file?.url
        const caption = image.caption || []
        const captionText = getPlainTextFromRichText(caption)

        if (!source) {
          return (
            <div key={block.id} className={className}>
              <div className="my-4 rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500">
                Unsupported image source
              </div>
            </div>
          )
        }

        return (
          <figure key={block.id} className={cn(className, 'my-6')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={source}
              alt={captionText || 'Notion image'}
              loading="lazy"
              className="w-full rounded-md"
            />
            {caption.length > 0 && (
              <figcaption className="mt-2 notion-asset-caption whitespace-pre-wrap">
                <RichText richText={caption} />
              </figcaption>
            )}
            {renderChildren(block.id)}
          </figure>
        )
      }
      case 'column_list': {
        const childIds = childrenById[block.id] || []
        const columns = childIds
          .map(id => blocksById[id])
          .filter((column: any) => column?.type === 'column')
        return (
          <div key={block.id} className={className}>
            {columns.length > 0 ? (
              <div className="my-4 flex flex-col gap-4 md:flex-row">
                {columns.map(renderColumnBlock)}
              </div>
            ) : (
              renderChildren(block.id)
            )}
          </div>
        )
      }
      case 'column':
        return renderColumnBlock(block)
      case 'embed': {
        const embed = block?.embed || {}
        const embedUrl = embed.url
        const iframeUrl = getEmbedUrl(embedUrl)
        const caption = embed.caption || []
        return (
          <div key={block.id} className={className}>
            <div className="my-4">
              {iframeUrl ? (
                <div className="relative w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    src={iframeUrl}
                    title={embedUrl || block.id}
                    className="absolute top-0 left-0 h-full w-full"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : !embedUrl ? (
                <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Unsupported embed block
                </div>
              ) : (
                <LinkPreviewCard url={embedUrl} />
              )}
              {caption.length > 0 && (
                <div className="notion-asset-caption mt-2 whitespace-pre-wrap">
                  <RichText richText={caption} />
                </div>
              )}
            </div>
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'bookmark': {
        const bookmark = block?.bookmark || {}
        const bookmarkUrl = bookmark.url
        const caption = bookmark.caption || []
        return (
          <div key={block.id} className={className}>
            {!bookmarkUrl ? (
              <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400 my-4">
                Unsupported bookmark block
              </div>
            ) : (
              <LinkPreviewCard url={bookmarkUrl} />
            )}
            {caption.length > 0 && (
              <div className="notion-asset-caption mt-2 whitespace-pre-wrap">
                <RichText richText={caption} />
              </div>
            )}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'divider':
        return (
          <div key={block.id} className={className}>
            <hr className="notion-hr my-4 border-zinc-200 dark:border-zinc-700" />
            {renderChildren(block.id)}
          </div>
        )
      case 'unsupported':
      default:
        return (
          <div key={block.id} className={className}>
            <div className="my-4 rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400">
              Unsupported block type: {block.type}
            </div>
            {renderChildren(block.id)}
          </div>
        )
    }
  }

  const renderBlockList = (blockIds: string[]) => {
    const nodes: React.ReactNode[] = []
    for (let i = 0; i < blockIds.length; i++) {
      const block = blocksById[blockIds[i]]
      if (!block) continue

      if (block.type === 'bulleted_list_item') {
        const listItems = [renderBulletedListItem(block)]
        while (i + 1 < blockIds.length) {
          const nextBlock = blocksById[blockIds[i + 1]]
          if (!nextBlock || nextBlock.type !== 'bulleted_list_item') break
          listItems.push(renderBulletedListItem(nextBlock))
          i += 1
        }
        nodes.push(
          <ul key={`bulleted-${block.id}`} className="notion-list list-disc my-3 space-y-1">
            {listItems}
          </ul>
        )
        continue
      }
      nodes.push(renderBlock(block))
    }
    return nodes
  }

  return (
    <>
      <style jsx global>
        {`
        .notion {
          --notion-font: ${font};
          font-family: var(--notion-font);
        }
        `}
      </style>
      <div className="notion">
        {renderBlockList(rootIds)}
      </div>
    </>
  )
}
