import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const file = await db.resourceFile.findUnique({ where: { id } })

    if (!file) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 })
    }

    const absolutePath = path.join(process.cwd(), file.filePath)
    try {
      await unlink(absolutePath)
    } catch {
      // File might already be deleted, continue with DB cleanup
    }

    // Delete from database
    await db.resourceFile.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete file error:', error)
    return NextResponse.json({ error: '删除文件失败' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const file = await db.resourceFile.findUnique({ where: { id } })

    if (!file) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 })
    }

    return NextResponse.json(file)
  } catch (error) {
    console.error('Get file error:', error)
    return NextResponse.json({ error: '获取文件信息失败' }, { status: 500 })
  }
}