import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest, NETWORK_ERROR_MESSAGE } from './client'

function mockFetch(response: Response | Error) {
  const fetchMock = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiRequest', () => {
  it('returns the parsed body of a successful response', async () => {
    mockFetch(json([{ id: '1' }]))

    await expect(apiRequest('/api/tasks')).resolves.toEqual([{ id: '1' }])
  })

  it('sends a JSON body with a JSON content type', async () => {
    const fetchMock = mockFetch(json({ id: '1' }, 201))

    await expect(apiRequest('/api/tasks', { method: 'POST', body: '{"title":"A"}' })).resolves.toEqual({ id: '1' })

    const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(path).toBe('/api/tasks')
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
  })

  it('uses the message from a JSON error body', async () => {
    mockFetch(json({ status: 409, error: 'Conflict', message: 'Only a DRAFT task can be started' }, 409))

    const error = await apiRequest('/api/tasks/1/start').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, message: 'Only a DRAFT task can be started' })
  })

  it('falls back to the status when the error body is not JSON', async () => {
    mockFetch(new Response('<html>oops</html>', { status: 500, statusText: 'Internal Server Error' }))

    await expect(apiRequest('/api/tasks')).rejects.toMatchObject({
      status: 500,
      message: 'Request failed with status 500 (Internal Server Error)',
    })
  })

  it('explains that the server is unreachable when the proxy answers 502', async () => {
    mockFetch(new Response('', { status: 502 }))

    await expect(apiRequest('/api/tasks')).rejects.toMatchObject({ status: 502, message: NETWORK_ERROR_MESSAGE })
  })

  it('explains that the server is unreachable when fetch itself fails', async () => {
    mockFetch(new TypeError('Failed to fetch'))

    await expect(apiRequest('/api/tasks')).rejects.toMatchObject({ status: 0, message: NETWORK_ERROR_MESSAGE })
  })
})
