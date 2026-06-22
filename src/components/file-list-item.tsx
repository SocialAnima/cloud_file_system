import { Download, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { FileIconDisplay } from '@/components/file-icon-display'
import { formatFileSize, getFileIcon, formatDate, getCategoryColor } from '@/lib/file-utils'
import type { ResourceFile } from '@prisma/client'

interface FileListItemProps {
  file: ResourceFile
  isAdmin: boolean
  onDownload: (f: ResourceFile) => void
  onDelete: (f: ResourceFile) => void
  onPreview: (f: ResourceFile) => void
}

export function FileListItem({ file, isAdmin, onDownload, onDelete, onPreview }: FileListItemProps) {
  return (
    <Card className="group hover:shadow-sm transition-all duration-200">
      <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
        <div
          className="p-2 rounded-lg bg-muted flex-shrink-0 cursor-pointer"
          onClick={() => onPreview(file)}
        >
          <FileIconDisplay type={getFileIcon(file.mimeType)} className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPreview(file)}>
          <h3 className="font-medium text-sm truncate">{file.originalName}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${getCategoryColor(file.category)}`}>
              {file.category}
            </Badge>
            <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">{formatDate(file.createdAt)}</span>
            <span className="text-xs text-muted-foreground hidden md:inline flex items-center gap-0.5">
              <Download className="h-3 w-3" />
              {file.downloadCount}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => onDownload(file)}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">下载</span>
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
      </CardContent>
    </Card>
  )
}
