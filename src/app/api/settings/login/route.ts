import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAndUpgradePassword,
  createSession,
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!password) {
      return NextResponse.json({ error: '请输入密码' }, { status: 400 })
    }

    const isValid = await verifyAndUpgradePassword(password)
    if (!isValid) {
      return NextResponse.json({ error: '密码错误' }, { status: 403 })
    }

    const token = await createSession()
    const response = NextResponse.json({ success: true })
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions())
    return response
  } catch (error) {
    console.error('Login verify error:', error)
    return NextResponse.json({ error: '验证失败' }, { status: 500 })
  }
}
