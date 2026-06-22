import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const isValid = await verifySession(request)
    return NextResponse.json({ authenticated: isValid })
  } catch {
    return NextResponse.json({ authenticated: false })
  }
}
