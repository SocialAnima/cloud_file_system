import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAndUpgradePassword,
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Login verify error:', error)
    return NextResponse.json({ error: '验证失败' }, { status: 500 })
  }
}
