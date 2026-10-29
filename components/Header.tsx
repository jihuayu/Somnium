import Link from 'next/link'
import Image from 'next/image'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS, ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
import HeaderBehavior from '@/components/HeaderBehavior'

interface NavLocale {
  INDEX: string
  ABOUT: string
  RSS: string
  SEARCH: string
}

interface NavBarProps {
  path: string
  showAbout: boolean
  locale: NavLocale
}

const NavBar = ({ path, showAbout, locale }: NavBarProps) => {
  const links = [
    { id: 0, name: locale.INDEX, to: path || '/', show: true },
    { id: 1, name: locale.ABOUT, to: '/about', show: showAbout },
    { id: 2, name: locale.RSS, to: '/feed', show: true, external: true },
    { id: 3, name: locale.SEARCH, to: '/search', show: true }
  ]

  return (
    <div className="header-nav-wrap flex-shrink-0 md:self-end">
      <ul className="header-nav-list flex flex-row items-end">
        {links.map(
          link =>
            link.show && (
              <li
                key={link.id}
                className="block ml-4 nav"
              >
                <Link
                  href={link.to}
                  target={link.external ? '_blank' : undefined}
                  className="text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors duration-150 ease-out"
                >
                  {link.name}
                </Link>
              </li>
            )
        )}
      </ul>
    </div>
  )
}

interface HeaderProps {
  navBarTitle?: string | null
  fullWidth?: boolean
  siteTitle: string
  siteDescription: string
  path: string
  showAbout: boolean
  autoCollapsedNavBar: boolean
  navLocale: NavLocale
}

interface HeaderNameProps {
  siteTitle: string
  siteDescription: string
  postTitle?: string | null
}

function HeaderName({ siteTitle, siteDescription, postTitle }: HeaderNameProps) {
  return (
    <p
      id="header-title"
      className={`header-name ${!postTitle ? 'header-name-no-post-title' : ''} font-serif font-semibold text-stone-900 dark:text-stone-100 capture-pointer-events grid-rows-1 grid-cols-1 items-end leading-none`}
    >
      {postTitle && <span className="post-title row-start-1 col-start-1 tracking-tight">{postTitle}</span>}
      <span className="row-start-1 col-start-1">
        <span className="site-title tracking-tight">{siteTitle}</span>
        <span className="site-description ml-2 text-xs font-normal text-stone-400 dark:text-stone-500">{siteDescription}</span>
      </span>
    </p>
  )
}

export default function Header({
  navBarTitle,
  fullWidth,
  siteTitle,
  siteDescription,
  path,
  showAbout,
  autoCollapsedNavBar,
  navLocale
}: HeaderProps) {
  const contentWidthClass = fullWidth ? ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS : ARTICLE_CONTENT_MAX_WIDTH_CLASS

  return (
    <>
      <HeaderBehavior useSticky={!autoCollapsedNavBar} fullWidth={fullWidth} />
      <div className="observer-element h-4 md:h-12" id="header-sentinel" />
      <div
        className={`sticky-nav group m-auto w-full h-6 flex flex-row justify-between items-center md:items-end mb-1 md:mb-6 py-8 px-4 ${contentWidthClass}`}
        id="sticky-nav"
      >
        <svg
          viewBox="0 0 24 24"
          className="caret w-6 h-6 absolute inset-x-0 bottom-0 mx-auto pointer-events-none opacity-30 group-hover:opacity-100 transition duration-100"
        >
          <path
            d="M12 10.828l-4.95 4.95-1.414-1.414L12 8l6.364 6.364-1.414 1.414z"
            className="fill-black dark:fill-white"
          />
        </svg>
        <div className="header-main flex items-center md:items-end gap-2">
          <Link href={path || '/'} aria-label={siteTitle} className="header-icon-link flex items-center md:items-end justify-center shrink-0 leading-none transition-transform duration-500">
            <Image
              src="/homepage-logo.png"
              width={26}
              height={26}
              alt=""
              aria-hidden
              className="block header-icon"
            />
          </Link>
          <HeaderName
            siteTitle={siteTitle}
            siteDescription={siteDescription}
            postTitle={navBarTitle}
          />
        </div>
        <NavBar path={path} showAbout={showAbout} locale={navLocale} />
      </div>
    </>
  )
}
