import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  formatQuote,
  inferSocialIcon,
  isExternalHref,
  padIndex,
  type SocialIcon
} from '@/lib/profile'

export interface MePagePost {
  id: string
  title: string
  slug: string
  tags: string[]
  date: number
}

export interface MePageSocial {
  label: string
  href: string
}

export interface MePageCopy {
  recent: string
  recentKicker: string
  guestbook: string
  posts: string
  days: string
  viewAll: string
  welcome: string
  subscribe: string
  subscribeHint: string
  writing: string
}

interface MePageProps {
  greeting: string
  name: string
  tagline: string
  quote: string
  avatar?: string
  postCount: number
  days: number
  season: string
  socials: MePageSocial[]
  posts: MePagePost[]
  blogPath: string
  copy: MePageCopy
  guestbook?: ReactNode
}

function postHref(blogPath: string, slug: string): string {
  const base = `${blogPath || ''}`.replace(/\/+$/, '')
  return `${base}/${slug}`
}

function SocialGlyph({ icon }: { icon: SocialIcon }) {
  const className = 'size-[18px]'
  if (icon === 'github') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={className}>
        <path
          fill="currentColor"
          d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.95 0-1.1.39-1.99 1.03-2.7-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.8c.85 0 1.7.11 2.5.32 1.9-1.29 2.74-1.02 2.74-1.02.55 1.37.2 2.39.1 2.64.64.71 1.03 1.6 1.03 2.7 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
        />
      </svg>
    )
  }
  if (icon === 'x') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={className}>
        <path
          fill="currentColor"
          d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-4.71-6.23-5.4 6.23H2.74l7.73-8.84L1.25 2.25H8.08l4.25 5.62 5.91-5.62Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z"
        />
      </svg>
    )
  }
  if (icon === 'mail') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={className}>
        <path
          fill="currentColor"
          d="M3.6 5.5h16.8A1.6 1.6 0 0 1 22 7.1v9.8a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 16.9V7.1A1.6 1.6 0 0 1 3.6 5.5Zm8.4 7.16L4.4 7.4v9.1h15.2V7.4l-7.6 5.26Zm-.37-1.5 7.77-5.16H4.6l7.03 5.16Z"
        />
      </svg>
    )
  }
  if (icon === 'rss') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={className}>
        <path
          fill="currentColor"
          d="M5.3 17.7a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6ZM3 4.2A16.8 16.8 0 0 1 19.8 21h-3.4A13.4 13.4 0 0 0 3 7.6V4.2Zm0 6.3A10.5 10.5 0 0 1 13.5 21H10A7.1 7.1 0 0 0 3 14V10.5Z"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M14.1 5.1a4.3 4.3 0 0 1 6.1 6.1l-2.4 2.4-1.4-1.4 2.4-2.4a2.3 2.3 0 0 0-3.3-3.3l-2.4 2.4-1.4-1.4 2.4-2.4Zm-8.5 8.5 2.4-2.4 1.4 1.4-2.4 2.4a2.3 2.3 0 0 0 3.3 3.3l2.4-2.4 1.4 1.4-2.4 2.4a4.3 4.3 0 1 1-6.1-6.1Zm2.8-4.7 6.7 6.7-1.4 1.4-6.7-6.7 1.4-1.4Z"
      />
    </svg>
  )
}

function SocialButton({ social }: { social: MePageSocial }) {
  const icon = inferSocialIcon(social.href, social.label)
  const external = isExternalHref(social.href)
  const isMail = social.href.startsWith('mailto:')
  const className = 'inline-flex size-10 items-center justify-center rounded-full text-stone-500 transition-colors duration-200 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800/80 dark:hover:text-stone-100'

  if (!external) {
    return (
      <Link href={social.href} aria-label={social.label} className={className}>
        <SocialGlyph icon={icon} />
      </Link>
    )
  }

  return (
    <a
      href={social.href}
      aria-label={social.label}
      className={className}
      rel={isMail ? 'me' : 'me noopener noreferrer'}
      target={isMail ? undefined : '_blank'}
    >
      <SocialGlyph icon={icon} />
    </a>
  )
}

export default function MePage({
  greeting,
  name,
  tagline,
  quote,
  avatar,
  postCount,
  days,
  season,
  socials,
  posts,
  blogPath,
  copy,
  guestbook
}: MePageProps) {
  const quoted = formatQuote(quote)
  const homeHref = blogPath || '/'
  const feedHref = '/feed'

  return (
    <div className="me-page">
      <section className="relative flex min-h-svh flex-col items-center px-6 py-10 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[42%] -z-10 size-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(255,240,210,0.22)_0%,transparent_55%)] lg:size-[450px] dark:bg-[radial-gradient(ellipse,rgba(180,200,255,0.08)_0%,transparent_55%)]"
        />
        <div className="flex-1" />

        <div className="me-enter">
          {avatar ? (
            <Image
              src={avatar}
              alt=""
              width={112}
              height={112}
              priority
              className="mx-auto size-20 rounded-full object-cover shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] lg:size-28 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            />
          ) : null}
          <h1 className={`max-w-[22em] text-[1.65rem] font-normal leading-snug text-stone-800 lg:text-[2.5rem] dark:text-stone-100 ${avatar ? 'mt-8' : ''}`}>
            {greeting ? <span className="font-normal text-stone-500 dark:text-stone-400">{greeting} </span> : null}
            <span className="font-medium tracking-[-0.03em]">{name}</span>
            {tagline ? (
              <>
                <br />
                <span className="font-normal text-stone-500 dark:text-stone-400">{tagline}</span>
              </>
            ) : null}
          </h1>
        </div>

        <div className="flex-[1.5]" />

        <div className="me-enter me-enter-delay">
          {quoted ? (
            <p className="mx-auto max-w-[65ch] font-serif text-sm italic leading-relaxed text-stone-400 dark:text-stone-500">
              {quoted}
            </p>
          ) : null}
          <p className="mt-3 text-[11px] tabular-nums tracking-wide text-stone-400 dark:text-stone-500">
            <span>{postCount} {copy.posts}</span>
            <span className="mx-2" aria-hidden>·</span>
            <span>{days} {copy.days}</span>
          </p>
          {socials.length > 0 ? (
            <ul className="mt-7 flex justify-center gap-2.5">
              {socials.map(social => (
                <li key={`${social.label}-${social.href}`}>
                  <SocialButton social={social} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {posts.length > 0 ? (
        <section className="mx-auto mt-6 w-full max-w-[52rem] px-6 pb-4 lg:px-8" aria-labelledby="me-recent-heading">
          <div className="me-enter me-enter-delay-2 mb-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400 dark:text-stone-500">
              {copy.recentKicker}
            </p>
            <h2
              id="me-recent-heading"
              className="mt-1.5 font-serif text-xl tracking-[0.12em] text-stone-600 lg:text-2xl dark:text-stone-300"
            >
              {copy.recent}
            </h2>
          </div>
          <ol className="me-enter me-enter-delay-3 relative">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-2 left-[18px] w-px bg-stone-200 dark:bg-stone-800"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute left-[18px] top-2 h-[42%] w-px bg-gradient-to-b from-stone-400 to-transparent dark:from-stone-500"
            />
            {posts.map((post, index) => {
              const featured = index === 0
              const caption = [copy.writing, post.tags?.[0]].filter(Boolean).join(' · ')
              return (
                <li key={post.id} className="relative py-5 pl-12">
                  <span
                    className={`absolute left-[18px] top-5 -translate-x-1/2 bg-day px-1 text-xs font-medium tabular-nums tracking-wide dark:bg-night ${
                      featured ? 'text-stone-700 dark:text-stone-200' : 'text-stone-400 dark:text-stone-500'
                    }`}
                  >
                    {padIndex(index + 1)}
                  </span>
                  <Link href={postHref(blogPath, post.slug)} prefetch={false} className="group block">
                    {featured && caption ? (
                      <span className="block text-xs text-stone-400 dark:text-stone-500">{caption}</span>
                    ) : null}
                    <h3
                      className={`hyphens-auto break-words text-stone-800 transition-colors duration-200 group-hover:text-stone-500 dark:text-stone-100 dark:group-hover:text-stone-300 ${
                        featured
                          ? 'mt-2 font-serif text-xl font-medium leading-snug lg:text-2xl'
                          : 'font-serif text-base font-normal leading-relaxed lg:text-lg'
                      }`}
                    >
                      {post.title}
                    </h3>
                    {!featured && caption ? (
                      <span className="mt-1 block text-xs text-stone-400 dark:text-stone-500">{caption}</span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ol>
          <p className="mt-6 pl-12">
            <Link
              href={homeHref}
              className="text-sm text-stone-400 transition-colors duration-200 hover:text-stone-800 dark:text-stone-500 dark:hover:text-stone-200"
            >
              {copy.viewAll}
            </Link>
          </p>
        </section>
      ) : null}

      <section className="mx-auto mt-20 w-full max-w-[52rem] px-6 pb-16 text-center lg:px-8">
        {season ? (
          <p className="font-serif text-xl tracking-[0.14em] text-stone-500 lg:text-2xl dark:text-stone-400">
            {season}
          </p>
        ) : null}
        <p className="mt-3 font-serif text-xl tracking-[0.14em] text-stone-500 lg:text-2xl dark:text-stone-400">
          {copy.welcome}
        </p>
        <div className="mt-14 mb-16 flex items-center justify-center gap-10">
          <a href="#guestbook" className="group text-center">
            <span className="block font-serif text-sm text-stone-500 transition-colors duration-200 group-hover:text-stone-900 dark:text-stone-400 dark:group-hover:text-stone-100">
              {copy.guestbook}
            </span>
            <span className="mt-1 block font-serif text-xs italic text-stone-400 dark:text-stone-500">♥</span>
          </a>
          <span className="h-6 w-px bg-stone-200 dark:bg-stone-800" aria-hidden />
          <Link href={feedHref} className="group text-center" target="_blank">
            <span className="block font-serif text-sm text-stone-500 transition-colors duration-200 group-hover:text-stone-900 dark:text-stone-400 dark:group-hover:text-stone-100">
              {copy.subscribe}
            </span>
            <span className="mt-1 block font-serif text-xs italic text-stone-400 dark:text-stone-500">
              {copy.subscribeHint}
            </span>
          </Link>
        </div>
        {guestbook ? (
          <div id="guestbook" className="scroll-mt-24 text-left">
            {guestbook}
          </div>
        ) : null}
      </section>
    </div>
  )
}
