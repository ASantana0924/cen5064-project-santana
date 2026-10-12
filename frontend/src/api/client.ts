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
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
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

  return (await response.json()) as T
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
