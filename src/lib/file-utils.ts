export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'sheet'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'presentation'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('tar') || mimeType.includes('gz')) return 'archive'
  if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('javascript') || mimeType.includes('typescript')) return 'code'
  return 'file'
}

export const FILE_CATEGORIES = [
  '全部',
  '文档',
  '图片',
  '视频',
  '音频',
  '压缩包',
  '软件',
  '其他',
] as const

export function suggestCategory(mimeType: string, originalName: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() ?? ''
  if (mimeType.startsWith('image/')) return '图片'
  if (mimeType.startsWith('video/')) return '视频'
  if (mimeType.startsWith('audio/')) return '音频'
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    ['doc', 'docx', 'pdf', 'txt', 'md', 'rtf', 'odt'].includes(ext)
  ) return '文档'
  if (
    mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') ||
    mimeType.includes('tar') || mimeType.includes('gz') ||
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)
  ) return '压缩包'
  if (
    ['exe', 'msi', 'dmg', 'app', 'deb', 'rpm', 'apk', 'sh', 'bat'].includes(ext)
  ) return '软件'
  return '其他'
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    '文档': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    '图片': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    '视频': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    '音频': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    '压缩包': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    '软件': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    '其他': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    '未分类': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  }
  return colors[category] || colors['其他']
}