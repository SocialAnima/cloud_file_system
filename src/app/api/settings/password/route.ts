import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminPassword, verifyPassword, setAdminPassword } from '@/lib/auth'

export async function GET() {
  try {
    const setting = await db.siteSetting.findUnique({ where: { key: 'admin_password' } })
    return NextResponse.json({ hasCustomPassword: !!setting })
  } catch (error) {
    console.error('Get password setting error:', error)
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { oldPassword, newPassword } = await request.json()

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: '请填写旧密码和新密码' }, { status: 400 })
    }
    if (newPassword.length < 4) {
      return NextResponse.json({ error: '新密码长度不能少于 4 个字符' }, { status: 400 })
    }
    if (newPassword.length > 32) {
      return NextResponse.json({ error: '新密码长度不能超过 32 个字符' }, { status: 400 })
    }

    const stored = await getAdminPassword()
    if (!verifyPassword(oldPassword, stored)) {
      return NextResponse.json({ error: '旧密码不正确' }, { status: 403 })
    }

    await setAdminPassword(newPassword)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: '修改密码失败' }, { status: 500 })
  }
}
