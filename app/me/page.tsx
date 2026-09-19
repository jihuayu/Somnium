import type { Metadata } from 'next'
import ContainerServer from '@/components/ContainerServer'
import Comments from '@/components/Comments'
import MePage from '@/components/MePage'
import { getAllPosts } from '@/lib/notion'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import { buildPageMetadata } from '@/lib/server/metadata'
import { config } from '@/lib/server/config'
import loadLocale from '@/assets/i18n'
import {
  countSiteDays,
  getMonthInTimeZone,
  getSeason,
  ME_GUESTBOOK_PAGE_KEY,
  ME_PAGE_SLUG
} from '@/lib/profile'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const profile = config.profile
  return buildPageMetadata({
    title: profile.name || config.author,
    description: profile.tagline || config.description,
    slug: ME_PAGE_SLUG
  })
}

function guestbookFrontMatter(title: string): PostData {
  return {
    id: ME_GUESTBOOK_PAGE_KEY,
    title,
    slug: ME_PAGE_SLUG,
    summary: '',
    tags: [],
    type: ['Page'],
    status: ['Published'],
    formats: [],
    fullWidth: false,
    date: 0
  }
}

export default async function MeRoutePage() {
  const [posts, locale] = await Promise.all([
    getAllPosts({ includePages: false }),
    loadLocale('basic', config.lang)
  ])

  const profile = config.profile
  const recentCount = Math.max(1, Math.floor(profile.recentPostCount) || 5)
  const recentPosts = posts.slice(0, recentCount)
  const earliestPostDate = posts.reduce((earliest, post) => {
    const timestamp = Number(post.date || 0)
    if (!timestamp) return earliest
    return earliest === 0 || timestamp < earliest ? timestamp : earliest
  }, 0)
  const now = new Date()
  const season = {
    spring: locale.ME.SEASON.SPRING,
    summer: locale.ME.SEASON.SUMMER,
    autumn: locale.ME.SEASON.AUTUMN,
    winter: locale.ME.SEASON.WINTER
  }[getSeason(getMonthInTimeZone(now, config.timezone))]
  const guestbookTitle = locale.ME.GUESTBOOK

  return (
    <ContainerServer layout="me">
      <MePage
        greeting={profile.greeting}
        name={profile.name || config.author}
        tagline={profile.tagline}
        quote={profile.quote || config.description}
        avatar={profile.avatar}
        postCount={posts.length}
        days={countSiteDays({
          sinceYear: config.since,
          now,
          earliestPostDate
        })}
        season={season}
        socials={profile.socials || []}
        posts={recentPosts}
        blogPath={config.path || ''}
        copy={{
          recent: locale.ME.RECENT,
          recentKicker: locale.ME.RECENT_KICKER,
          guestbook: guestbookTitle,
          posts: locale.ME.POSTS,
          days: locale.ME.DAYS,
          viewAll: locale.ME.VIEW_ALL,
          welcome: locale.ME.WELCOME,
          subscribe: locale.ME.SUBSCRIBE,
          subscribeHint: locale.ME.SUBSCRIBE_HINT,
          writing: locale.ME.WRITING
        }}
        guestbook={profile.showGuestbook ? (
          <Comments
            compact
            frontMatter={guestbookFrontMatter(guestbookTitle)}
            comment={config.comment}
            labels={{ title: guestbookTitle }}
          />
        ) : null}
      />
    </ContainerServer>
  )
}
