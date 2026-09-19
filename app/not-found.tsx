import Link from 'next/link'
import ContainerServer from '@/components/ContainerServer'
import loadLocale from '@/assets/i18n'
import { config } from '@/lib/server/config'

export default async function NotFound() {
  const locale = await loadLocale('basic', config.lang)

  return (
    <ContainerServer>
      <div className="flex flex-col items-center py-24 text-center">
        <p className="font-serif text-sm text-stone-400 dark:text-stone-500">404</p>
        <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          {locale.PAGE.ERROR_404.MESSAGE}
        </h1>
        <Link
          href={config.path || '/'}
          className="mt-8 text-sm text-stone-400 transition-colors duration-150 ease-out hover:text-stone-900 dark:text-stone-500 dark:hover:text-stone-100"
        >
          {locale.POST.BACK}
        </Link>
      </div>
    </ContainerServer>
  )
}
