import ContainerServer from '@/components/ContainerServer'

export default function NotFound() {
  return (
    <ContainerServer>
      <h1 className="text-5xl text-black dark:text-white text-center">404</h1>
      <p className="text-xl text-gray-600 dark:text-gray-300 text-center">Page not found</p>
    </ContainerServer>
  )
}
