'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  Download,
  Search,
  FileText,
  HardDrive,
  BarChart3,
  Clock,
  FolderOpen,
  X,
  ChevronUp,
  ChevronDown,
  Grid3X3,
  List,
  RefreshCw,
  Shield,
  KeyRound,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { formatFileSize, getFileIcon, FILE_CATEGORIES, formatDate, getCategoryColor } from '@/lib/file-utils'
import { apiPath } from '@/lib/paths'
import { FileIconDisplay } from '@/components/file-icon-display'
import { StatCard } from '@/components/stat-card'
import { FileCard } from '@/components/file-card'
import { FileListItem } from '@/components/file-list-item'
import type { ResourceFile } from '@prisma/client'

interface FileStats {
  totalFiles: number
  totalSize: number
  totalDownloads: number
  categoryStats: { category: string; _count: { id: number }; _sum: { size: number | null; downloadCount: number | null } }[]
  recentFiles: Pick<ResourceFile, 'id' | 'originalName' | 'size' | 'category' | 'downloadCount' | 'createdAt'>[]
}

export default function Home() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isAdmin, setIsAdmin] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [showAdminLogin, setShowAdminLogin] = useState(false)

  const [files, setFiles] = useState<ResourceFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('全部')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [stats, setStats] = useState<FileStats | null>(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const [deleteTarget, setDeleteTarget] = useState<ResourceFile | null>(null)
  const [previewFile, setPreviewFile] = useState<ResourceFile | null>(null)

  const [showChangePwd, setShowChangePwd] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        search, category, sortBy, sortOrder,
        page: page.toString(),
        pageSize: '12',
      })
      const res = await fetch(apiPath(`/api/files?${params}`))
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      }
    } catch {
      toast({ title: '加载失败', description: '无法获取文件列表', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, category, sortBy, sortOrder, page, toast])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(apiPath('/api/files/stats'))
      if (res.ok) setStats(await res.json())
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchFiles() }, [fetchFiles])
  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { setPage(1) }, [search, category, sortBy, sortOrder])

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      if (uploadCategory) formData.append('category', uploadCategory)
      if (uploadDescription) formData.append('description', uploadDescription)

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + Math.random() * 20, 90))
      }, 200)

      const res = await fetch(apiPath('/api/files/upload'), { method: 'POST', body: formData })
      clearInterval(progressInterval)

      if (res.ok) {
        setUploadProgress(100)
        toast({ title: '上传成功', description: `${uploadFile.name} 已上传` })
        setUploadOpen(false)
        resetUploadForm()
        fetchFiles()
        fetchStats()
      } else {
        const data = await res.json()
        toast({ title: '上传失败', description: data.error || '未知错误', variant: 'destructive' })
      }
    } catch {
      toast({ title: '上传失败', description: '网络错误，请重试', variant: 'destructive' })
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const resetUploadForm = () => {
    setUploadFile(null)
    setUploadCategory('')
    setUploadDescription('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDownload = async (file: ResourceFile) => {
    try {
      // 不使用 fetch+blob：很多浏览器会把“异步后触发的 a.click()”当作非用户手势从而拦截下载
      const url = apiPath(`/api/files/${file.id}/download`)
      const a = document.createElement('a')
      a.href = url
      // 让浏览器按响应头 Content-Disposition 处理下载（文件名也由服务端决定更可靠）
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, downloadCount: f.downloadCount + 1 } : f))
      fetchStats()
    } catch {
      toast({ title: '下载失败', description: '网络错误，请重试', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(apiPath(`/api/files/${deleteTarget.id}`), { method: 'DELETE' })
      if (res.ok) {
        toast({ title: '删除成功', description: `${deleteTarget.originalName} 已删除` })
        fetchFiles()
        fetchStats()
      } else {
        toast({ title: '删除失败', description: '无法删除文件', variant: 'destructive' })
      }
    } catch {
      toast({ title: '删除失败', description: '网络错误，请重试', variant: 'destructive' })
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleAdminLogin = async () => {
    try {
      const res = await fetch(apiPath('/api/settings/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      })
      if (res.ok) {
        setIsAdmin(true)
        setShowAdminLogin(false)
        setAdminPassword('')
        toast({ title: '已进入管理模式' })
      } else {
        const data = await res.json()
        toast({ title: data.error || '密码错误', description: '请输入正确的管理员密码', variant: 'destructive' })
      }
    } catch {
      toast({ title: '登录失败', variant: 'destructive' })
    }
  }

  const handleLogout = async () => {
    setIsAdmin(false)
    toast({ title: '已退出管理模式' })
  }

  const handleChangePassword = async () => {
    if (!oldPwd || !newPwd || !confirmPwd) {
      toast({ title: '请填写所有字段', variant: 'destructive' })
      return
    }
    if (newPwd !== confirmPwd) {
      toast({ title: '两次输入的新密码不一致', variant: 'destructive' })
      return
    }
    if (newPwd.length < 4) {
      toast({ title: '新密码长度不能少于 4 个字符', variant: 'destructive' })
      return
    }
    setChangingPwd(true)
    try {
      const res = await fetch(apiPath('/api/settings/password'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      })
      if (res.ok) {
        toast({ title: '密码修改成功', description: '下次登录请使用新密码' })
        setShowChangePwd(false)
        setOldPwd(''); setNewPwd(''); setConfirmPwd('')
      } else {
        const data = await res.json()
        toast({ title: '修改失败', description: data.error || '未知错误', variant: 'destructive' })
      }
    } catch {
      toast({ title: '修改失败', description: '网络错误，请重试', variant: 'destructive' })
    } finally {
      setChangingPwd(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">资源下载中心</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">上传、浏览和下载文件资源</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) resetUploadForm() }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">上传文件</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>上传文件</DialogTitle>
                    <DialogDescription>选择文件并填写相关信息</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div
                      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadFile(f) }}
                      />
                      {uploadFile ? (
                        <div className="space-y-1">
                          <FileIconDisplay type={getFileIcon(uploadFile.type || '')} className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-sm font-medium truncate">{uploadFile.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(uploadFile.size)}</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">点击选择文件</p>
                          <p className="text-xs text-muted-foreground">支持最大 100MB</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>分类</Label>
                      <Select value={uploadCategory} onValueChange={setUploadCategory}>
                        <SelectTrigger><SelectValue placeholder="自动分类" /></SelectTrigger>
                        <SelectContent>
                          {FILE_CATEGORIES.filter(c => c !== '全部').map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>描述（可选）</Label>
                      <Textarea value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} placeholder="为文件添加描述..." rows={2} />
                    </div>
                    {uploading && (
                      <div className="space-y-1">
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground text-center">{uploadProgress >= 100 ? '处理中...' : '上传中...'}</p>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setUploadOpen(false); resetUploadForm() }} disabled={uploading}>取消</Button>
                    <Button onClick={handleUpload} disabled={!uploadFile || uploading}>{uploading ? '上传中...' : '确认上传'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {isAdmin ? (
              <>
                <Dialog open={showChangePwd} onOpenChange={open => { setShowChangePwd(open); if (!open) { setOldPwd(''); setNewPwd(''); setConfirmPwd('') } }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5" title="修改密码">
                      <KeyRound className="h-4 w-4" />
                      <span className="hidden sm:inline">修改密码</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>修改管理密码</DialogTitle>
                      <DialogDescription>输入旧密码和新密码来完成修改</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <div className="space-y-1.5">
                        <Label>旧密码</Label>
                        <Input type="password" placeholder="请输入旧密码" value={oldPwd} onChange={e => setOldPwd(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>新密码</Label>
                        <Input type="password" placeholder="请输入新密码（至少 4 位）" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>确认新密码</Label>
                        <Input type="password" placeholder="请再次输入新密码" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChangePassword()} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowChangePwd(false)} disabled={changingPwd}>取消</Button>
                      <Button onClick={handleChangePassword} disabled={changingPwd}>{changingPwd ? '修改中...' : '确认修改'}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">管理中</span>
                </Button>
              </>
            ) : (
              <Dialog open={showAdminLogin} onOpenChange={setShowAdminLogin}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">管理</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>管理员登录</DialogTitle>
                    <DialogDescription>请输入管理员密码以进入管理模式</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <Input type="password" placeholder="请输入密码" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} />
                    <p className="text-xs text-muted-foreground">请输入管理员密码</p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAdminLogin(false)}>取消</Button>
                    <Button onClick={handleAdminLogin}>确认</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon={<FileText className="h-5 w-5" />} label="总文件数" value={stats.totalFiles.toString()} />
            <StatCard icon={<HardDrive className="h-5 w-5" />} label="总存储量" value={formatFileSize(stats.totalSize)} />
            <StatCard icon={<Download className="h-5 w-5" />} label="总下载量" value={stats.totalDownloads.toString()} />
            <StatCard icon={<BarChart3 className="h-5 w-5" />} label="分类数" value={stats.categoryStats.length.toString()} />
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜索文件名或描述..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">最新上传</SelectItem>
              <SelectItem value="originalName">名称排序</SelectItem>
              <SelectItem value="size">文件大小</SelectItem>
              <SelectItem value="downloadCount">下载次数</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')} title={sortOrder === 'asc' ? '升序' : '降序'}>
            {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <div className="flex border rounded-md">
            <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" className="rounded-r-none h-9 w-9" onClick={() => setViewMode('grid')}>
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" className="rounded-l-none h-9 w-9" onClick={() => setViewMode('list')}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="icon" onClick={() => { fetchFiles(); fetchStats() }} title="刷新">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {total} 个文件</span>
          {search && <span>搜索：&ldquo;{search}&rdquo;</span>}
        </div>

        {/* File list */}
        {loading ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          )
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">暂无文件</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin ? '点击上方"上传文件"按钮开始上传资源' : '等待管理员上传资源'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${viewMode}-${category}-${search}-${sortBy}-${sortOrder}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {files.map(file => (
                    <FileCard key={file.id} file={file} isAdmin={isAdmin} onDownload={handleDownload} onDelete={setDeleteTarget} onPreview={setPreviewFile} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map(file => (
                    <FileListItem key={file.id} file={file} isAdmin={isAdmin} onDownload={handleDownload} onDelete={setDeleteTarget} onPreview={setPreviewFile} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button variant="outline" size="icon" className="h-9 w-9" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) pageNum = i + 1
              else if (page <= 3) pageNum = i + 1
              else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
              else pageNum = page - 2 + i
              return (
                <Button key={pageNum} variant={page === pageNum ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={() => setPage(pageNum)}>
                  {pageNum}
                </Button>
              )
            })}
            <Button variant="outline" size="icon" className="h-9 w-9" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>资源下载中心 &copy; {new Date().getFullYear()}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(new Date().toISOString())}
          </span>
        </div>
      </footer>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 <strong>{deleteTarget?.originalName}</strong> 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={open => !open && setPreviewFile(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>文件详情</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <FileIconDisplay type={getFileIcon(previewFile.mimeType)} className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="font-medium truncate">{previewFile.originalName}</h3>
                  <Badge variant="secondary" className={getCategoryColor(previewFile.category)}>{previewFile.category}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">文件大小</p>
                  <p className="font-medium">{formatFileSize(previewFile.size)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">文件类型</p>
                  <p className="font-medium truncate">{previewFile.mimeType}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">下载次数</p>
                  <p className="font-medium">{previewFile.downloadCount} 次</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">上传时间</p>
                  <p className="font-medium">{formatDate(previewFile.createdAt)}</p>
                </div>
              </div>
              {previewFile.description && (
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">描述</p>
                  <p className="text-foreground">{previewFile.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewFile(null)}>关闭</Button>
            {previewFile && (
              <Button onClick={() => { handleDownload(previewFile); setPreviewFile(null) }} className="gap-1.5">
                <Download className="h-4 w-4" />
                下载
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
