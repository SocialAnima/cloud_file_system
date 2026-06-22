import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mkdir } from 'fs/promises'
import { createWriteStream } from 'fs'
import { statSync } from 'fs'
import path from 'path'
import { suggestCategory } from '@/lib/file-utils'
import { v4 as uuidv4 } from 'uuid'
import Busboy from 'busboy'
import { Readable } from 'stream'

export const runtime = 'nodejs'
export const maxDuration = 120

// 100MB limit
const MAX_FILE_SIZE = 100 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads')
    await mkdir(uploadsDir, { recursive: true })

    // Get the raw request body as a Node.js Readable stream
    const webStream = request.body
    if (!webStream) {
      return NextResponse.json({ error: '请求体为空' }, { status: 400 })
    }
    const nodeStream = Readable.fromWeb(webStream as Parameters<typeof Readable.fromWeb>[0])

    const result = await new Promise<{
      originalName: string
      mimeType: string
      size: number
      category: string
      description: string
      relativePath: string
      uniqueName: string
    }>((resolve, reject) => {
      let fileData: {
        originalName: string
        mimeType: string
        size: number
        category: string
        description: string
        relativePath: string
        uniqueName: string
        writeStream: ReturnType<typeof createWriteStream>,
      } | null = null

      const bb = Busboy({
        headers: { 'content-type': contentType },
        limits: {
          fileSize: MAX_FILE_SIZE,
          fieldSize: 1 * 1024 * 1024, // 1MB for text fields
        },
      })

      bb.on('file', (_fieldname: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
        const fileExt = info.filename.split('.').pop() || ''
        const uniqueName = `${uuidv4()}.${fileExt}`
        const relativePath = path.join('uploads', uniqueName)
        const absolutePath = path.join(process.cwd(), relativePath)

        const writeStream = createWriteStream(absolutePath)
        let totalSize = 0

        file.on('data', (chunk: Buffer) => {
          totalSize += chunk.length
        })

        file.on('limit', () => {
          writeStream.destroy()
          bb.destroy()
          reject(new Error('文件大小不能超过 100MB'))
        })

        fileData = {
          originalName: info.filename,
          mimeType: info.mimeType || 'application/octet-stream',
          size: 0,
          category: '',
          description: '',
          relativePath,
          uniqueName,
          writeStream,
        }

        file.pipe(writeStream)
      })

      bb.on('field', (fieldname: string, value: string) => {
        if (fileData) {
          if (fieldname === 'category') fileData.category = value
          if (fieldname === 'description') fileData.description = value
        }
      })

      bb.on('finish', () => {
        if (!fileData) {
          reject(new Error('请选择要上传的文件'))
          return
        }
        if (fileData.size === 0) {
          const stat = statSync(path.join(process.cwd(), fileData.relativePath))
          fileData.size = stat.size
        }
        resolve(fileData)
      })

      bb.on('error', (err: Error) => {
        reject(err)
      })

      nodeStream.pipe(bb)
    })

    if (result.size === 0) {
      return NextResponse.json({ error: '文件不能为空' }, { status: 400 })
    }

    const finalCategory = result.category || suggestCategory(result.mimeType, result.originalName)

    const resourceFile = await db.resourceFile.create({
      data: {
        name: result.uniqueName,
        originalName: result.originalName,
        mimeType: result.mimeType,
        size: result.size,
        category: finalCategory,
        description: result.description || '',
        filePath: result.relativePath,
      },
    })

    return NextResponse.json({
      success: true,
      file: {
        id: resourceFile.id,
        originalName: resourceFile.originalName,
        size: resourceFile.size,
        category: resourceFile.category,
        mimeType: resourceFile.mimeType,
        createdAt: resourceFile.createdAt,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '文件上传失败，请重试'
    console.error('Upload error:', error)
    return NextResponse.json({ error: message }, { status: message.includes('100MB') ? 400 : 500 })
  }
}