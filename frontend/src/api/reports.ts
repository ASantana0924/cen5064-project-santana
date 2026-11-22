import { saveFile } from '@/lib/download'

import { apiDownload } from './client'

/** Used when the server sends no file name, which it always should. */
const FALLBACK_FILE_NAME = 'verifai-report.md'

export function reportPath(taskId: string): string {
  return `/api/tasks/${encodeURIComponent(taskId)}/report`
}

/**
 * UC-18: downloads the task's verification report and saves it as a Markdown
 * file under the name the server chose. Returns that name.
 */
export async function downloadReport(taskId: string): Promise<string> {
  const { blob, fileName } = await apiDownload(reportPath(taskId), 'text/markdown')
  const name = fileName ?? FALLBACK_FILE_NAME
  saveFile(blob, name)
  return name
}
