import type { ApiErrorBody } from './types'

export const NETWORK_ERROR_MESSAGE = 'Cannot reach the server. Is the backend running on port 8080?'

/**
 * Error thrown for every failed request. status is the HTTP status code, or 0
 * when the server could not be reached. message is always readable.
 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Sends a request to the backend and returns the parsed JSON body. */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await send(path, init, 'application/json')
  return (await response.json()) as T
}

/** A file from the backend and the name the server gave it, if any. */
export interface DownloadedFile {
  blob: Blob
  fileName: string | null
}

/**
 * Downloads a file of the given type, such as "text/markdown". JSON is accepted
 * too, so a failure still arrives as a readable message in an ApiError.
 */
export async function apiDownload(path: string, type: string): Promise<DownloadedFile> {
  const response = await send(path, {}, `${type}, application/json`)
  return { blob: await response.blob(), fileName: fileNameFrom(response.headers.get('Content-Disposition')) }
}

/**
 * The file name in a Content-Disposition header. The UTF-8 form
 * (filename*=UTF-8''...) wins over the plain one (filename="..."), as RFC 6266 says.
 */
export function fileNameFrom(header: string | null): string | null {
  if (!header) {
    return null
  }
  const extended = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim())
    } catch {
      // Badly encoded. Fall back to the plain name.
    }
  }
  const quoted = /filename\s*=\s*"((?:[^"\\]|\\.)*)"/i.exec(header)
  if (quoted) {
    return quoted[1].replace(/\\(.)/g, '$1')
  }
  const token = /filename\s*=\s*([^;\s]+)/i.exec(header)
  return token ? token[1] : null
}

async function send(path: string, init: RequestInit, accept: string): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Accept', accept)
  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response))
  }
  return response
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  try {
    const body = JSON.parse(text) as Partial<ApiErrorBody>
    if (typeof body.message === 'string' && body.message.trim() !== '') {
      return body.message
    }
  } catch {
    // Not JSON. The Vite proxy answers this way when the backend is down.
  }
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return NETWORK_ERROR_MESSAGE
  }
  return `Request failed with status ${response.status}${response.statusText ? ` (${response.statusText})` : ''}`
}
