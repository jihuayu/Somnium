import { NextResponse } from 'next/server'
import { clientConfig } from '@/lib/server/config'

export function GET() {
  return NextResponse.json(clientConfig)
}
