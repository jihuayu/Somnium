import cn from 'classnames'
import ContainerServer, { type NavLocale } from '@/components/ContainerServer'
import Comments from '@/components/Comments'
import Post from '@/components/Post'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
import { config } from '@/lib/server/config'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import type { NotionRenderModel } from '@/packages/notion-react/src'

interface SlugPageViewProps {
  post: PostData
  model: NotionRenderModel
  fullWidth: boolean
  homePath: string
  backLabel: string
  topLabel: string
  navLocale: NavLocale
}

export default function SlugPageView({
  post,
  model,
  fullWidth,
  homePath,
  backLabel,
  topLabel,
  navLocale
}: SlugPageViewProps) {
  return (
    <ContainerServer
      layout="blog"
      title={post.title}
      fullWidth={fullWidth}
      navLocale={navLocale}
    >
      <Post post={post} model={model} fullWidth={fullWidth} />

      <div
        className={cn(
          'px-4 flex justify-between font-medium text-gray-500 dark:text-gray-400 my-5',
          fullWidth ? 'md:px-24' : `mx-auto ${ARTICLE_CONTENT_MAX_WIDTH_CLASS}`
        )}
      >
        <a href={homePath || '/'} className="mt-2 cursor-pointer hover:text-black dark:hover:text-gray-100">
          ← {backLabel}
        </a>
        <a href="#top" className="mt-2 cursor-pointer hover:text-black dark:hover:text-gray-100">
          ↑ {topLabel}
        </a>
      </div>

      <Comments
        frontMatter={post}
        comment={config.comment}
        appearance={config.appearance}
      />
    </ContainerServer>
  )
}