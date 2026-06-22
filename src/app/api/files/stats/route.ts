import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [totalFiles, totalSize, totalDownloads, categoryStats] = await Promise.all([
      db.resourceFile.count(),
      db.resourceFile.aggregate({ _sum: { size: true } }),
      db.resourceFile.aggregate({ _sum: { downloadCount: true } }),
      db.resourceFile.groupBy({
        by: ['category'],
        _count: { id: true },
        _sum: { size: true, downloadCount: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ])

    // Recent files
    const recentFiles = await db.resourceFile.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        originalName: true,
        size: true,
        category: true,
        downloadCount: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      totalFiles,
      totalSize: totalSize._sum.size || 0,
      totalDownloads: totalDownloads._sum.downloadCount || 0,
      categoryStats,
      recentFiles,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: '获取统计数据失败' }, { status: 500 })
  }
}