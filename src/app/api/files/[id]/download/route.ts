import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createReadStream, statSync } from 'fs'
import { Readable } from 'stream'
import path from 'path'

export const runtime = 'nodejs'

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

    const absolutePath = path.join(process.cwd(), file.filePath)
    let stat
    try {
      stat = statSync(absolutePath)
    } catch {
      return NextResponse.json({ error: '文件已丢失' }, { status: 404 })
    }

    db.resourceFile.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    }).catch(() => {})

    const encodedName = encodeURIComponent(file.originalName).replace(/'/g, '%27')
    const nodeStream = createReadStream(absolutePath)
    const webStream = Readable.toWeb(nodeStream) as ReadableStream

    return new Response(webStream, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Download file error:', error)
    return NextResponse.json({ error: '下载文件失败' }, { status: 500 })
  }
}
