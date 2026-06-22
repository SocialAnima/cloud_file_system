import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { originalName: { contains: search } },
        { description: { contains: search } },
      ]
    }

    if (category && category !== '全部') {
      where.category = category
    }

    const orderBy: Record<string, string> = {}
    if (['createdAt', 'size', 'downloadCount', 'originalName'].includes(sortBy)) {
      orderBy[sortBy] = sortOrder === 'asc' ? 'asc' : 'desc'
    } else {
      orderBy.createdAt = 'desc'
    }

    const [files, total] = await Promise.all([
      db.resourceFile.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.resourceFile.count({ where }),
    ])

    return NextResponse.json({
      files,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('List files error:', error)
    return NextResponse.json({ error: '获取文件列表失败' }, { status: 500 })
  }
}