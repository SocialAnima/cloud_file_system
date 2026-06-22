import { Download, Clock, Eye, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { FileIconDisplay } from '@/components/file-icon-display'
import { formatFileSize, getFileIcon, formatDate, getCategoryColor } from '@/lib/file-utils'
import type { ResourceFile } from '@prisma/client'

interface FileCardProps {
  file: ResourceFile
  isAdmin: boolean
  onDownload: (f: ResourceFile) => void
  onDelete: (f: ResourceFile) => void
  onPreview: (f: ResourceFile) => void
}

export function FileCard({ file, isAdmin, onDownload, onDelete, onPreview }: FileCardProps) {
  return (
    <Card className="group hover:shadow-md transition-all duration-200 overflow-hidden">
      <CardContent className="p-0">
        <div
          className="h-32 flex items-center justify-center bg-muted/50 cursor-pointer"
          onClick={() => onPreview(file)}
        >
          <FileIconDisplay type={getFileIcon(file.mimeType)} className="h-14 w-14 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <h3 className="font-medium text-sm truncate cursor-pointer hover:text-primary transition-colors" onClick={() => onPreview(file)}>
              {file.originalName}
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${getCategoryColor(file.category)}`}>
                {file.category}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(file.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {file.downloadCount}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => onDownload(file)}>
              <Download className="h-3.5 w-3.5" />
              下载
            </Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => onPreview(file)} title="查看详情">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(file)}
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
