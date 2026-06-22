import {
  File,
  FileCode,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Music,
  Presentation,
  Video,
  Archive,
} from 'lucide-react'

export function FileIconDisplay({ type, className = 'h-10 w-10' }: { type: string; className?: string }) {
  const props = { className, strokeWidth: 1.5 }
  switch (type) {
    case 'image': return <ImageIcon {...props} />
    case 'video': return <Video {...props} />
    case 'audio': return <Music {...props} />
    case 'pdf': case 'doc': return <FileText {...props} />
    case 'sheet': return <FileSpreadsheet {...props} />
    case 'presentation': return <Presentation {...props} />
    case 'archive': return <Archive {...props} />
    case 'code': return <FileCode {...props} />
    default: return <File {...props} />
  }
}
