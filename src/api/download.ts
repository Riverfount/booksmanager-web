import { api, call } from './client'

/** File name from a `Content-Disposition` header, or the fallback when the header is missing or has no name. */
export function downloadName(contentDisposition: string | null, fallback: string): string {
  const match = contentDisposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  return match ? decodeURIComponent(match[1]) : fallback
}

/** Hands a downloaded file to the browser through a temporary link. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export type ExportPath =
  | '/api/v1/reports/overdue-loans/pdf'
  | '/api/v1/reports/overdue-loans/csv'
  | '/api/v1/reports/most-borrowed-books/pdf'
  | '/api/v1/reports/most-borrowed-books/csv'
  | '/api/v1/reports/collection-status/pdf'
  | '/api/v1/reports/collection-status/csv'

type Download = Promise<{ data?: Blob; error?: unknown; response: Response }>

/** Downloads a report export (admin only) through the API client, so the session token and its renewal apply, and saves the file. */
export async function exportReport(path: ExportPath, fallbackName: string, query?: { from: string; to: string }): Promise<void> {
  let disposition: string | null = null
  const get = api.GET as unknown as (path: string, init: object) => Download
  const blob = await call(
    get(path, { params: { query }, parseAs: 'blob' }).then((r) => {
      disposition = r.response.headers.get('Content-Disposition')
      return r
    }),
  )
  saveBlob(blob, downloadName(disposition, fallbackName))
}
