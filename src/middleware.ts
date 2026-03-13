import type { MiddlewareHandler } from 'astro'

export const onRequest: MiddlewareHandler = async (_context, next) => {
  const response = await next()
  response.headers.set('Permissions-Policy', 'interest-cohort=()')
  return response
}