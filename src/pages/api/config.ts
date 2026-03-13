import type { APIRoute } from 'astro'
import { clientConfig } from '@/lib/server/config'

export const GET: APIRoute = async () => Response.json(clientConfig)