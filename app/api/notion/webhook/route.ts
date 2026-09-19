import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function retired(): NextResponse {
  return NextResponse.json(
    {
      error: 'Notion webhook retired',
      message: 'Configure the Notion subscription on Atrium. Atrium will notify /api/cache/revalidate after it commits content.'
    },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  )
}

export async function GET(): Promise<NextResponse> {
  return retired()
}

export async function POST(): Promise<NextResponse> {
  return retired()
}
