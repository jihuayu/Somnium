import Image from 'next/image'
import Link from 'next/link'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'

interface HeaderProps {
  siteTitle: string
  siteDescription?: string
  path: string
  showAbout: boolean
  navLocale: { ABOUT: string; SEARCH: string }
}

export default function Header({ siteTitle, siteDescription, path, showAbout, navLocale }: HeaderProps) {
  return (
    <header className={`site-header mx-auto w-full px-5 ${ARTICLE_CONTENT_MAX_WIDTH_CLASS}`}>
      <div className="flex items-center justify-between gap-3">
        <Link href={path} className="site-brand inline-flex min-h-11 items-center gap-2 font-serif text-xl font-semibold">
          <Image src="/homepage-logo.png" width={30} height={30} alt="" />
          {siteTitle}
        </Link>
        <nav aria-label="主导航" className="site-nav flex items-center gap-2 text-sm">
          {showAbout && <Link href="/about">{navLocale.ABOUT}</Link>}
          <Link href="/search">{navLocale.SEARCH}</Link>
        </nav>
      </div>
      {siteDescription && <p className="site-description ml-[2.375rem] text-sm">{siteDescription}</p>}
    </header>
  )
}
