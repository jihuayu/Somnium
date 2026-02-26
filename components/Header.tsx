import Link from 'next/link'
import Image from 'next/image'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
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
                className="block ml-4 text-black dark:text-gray-50 nav"
              >
                <Link href={link.to} target={link.external ? '_blank' : undefined}>{link.name}</Link>
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
      className={`header-name ${!postTitle ? 'header-name-no-post-title' : ''} font-medium text-gray-600 dark:text-gray-300 capture-pointer-events grid-rows-1 grid-cols-1 items-end leading-none`}
    >
      {postTitle && <span className="post-title row-start-1 col-start-1">{postTitle}</span>}
      <span className="row-start-1 col-start-1">
        <span className="site-title">{siteTitle}</span>
        <span className="site-description ml-2 text-xs font-normal">{siteDescription}</span>
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
  return (
    <>
      <HeaderBehavior useSticky={!autoCollapsedNavBar} />
      <div className="observer-element h-4 md:h-12" id="header-sentinel" />
      <div
        className={`sticky-nav group m-auto w-full h-6 flex flex-row justify-between items-center md:items-end mb-1 md:mb-6 py-8 bg-opacity-60 ${
          !fullWidth ? `${ARTICLE_CONTENT_MAX_WIDTH_CLASS} px-4` : 'px-4 md:px-24'
        }`}
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
              src="/favicon.png"
              width={26}
              height={26}
              alt={siteTitle}
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
