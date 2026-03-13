import ContainerServer, { type NavLocale } from '@/components/ContainerServer'

interface NotFoundPageViewProps {
  navLocale: NavLocale
}

export default function NotFoundPageView({ navLocale }: NotFoundPageViewProps) {
  return (
    <ContainerServer navLocale={navLocale}>
      <h1 className="text-5xl text-black dark:text-white text-center">404</h1>
      <p className="text-xl text-gray-600 dark:text-gray-300 text-center">Page not found</p>
    </ContainerServer>
  )
}