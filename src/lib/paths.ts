/** 与 next.config.ts 中的 basePath 保持一致 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/cloud_file_system'

export function apiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${basePath}${normalized}`
}
