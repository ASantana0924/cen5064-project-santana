import type { MockedFunction } from 'vitest'

import type { apiRequest } from '@/api/client'

/** A reply for routeApi: a value is returned, an Error is thrown, and a function is called with the request. */
export type Reply = unknown | Error | ((init?: RequestInit) => Promise<unknown>)

/**
 * Answers mocked apiRequest calls by "METHOD path", for example
 * "POST /api/tasks/1111/start". An unexpected request fails with an error
 * naming it, so a test that sends the wrong request says so.
 */
export function routeApi(api: MockedFunction<typeof apiRequest>, routes: Record<string, Reply>) {
  api.mockImplementation(((path: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${path}`
    if (!(key in routes)) {
      return Promise.reject(new Error(`Unexpected request: ${key}`))
    }
    const reply = routes[key]
    if (typeof reply === 'function') {
      return reply(init)
    }
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply)
  }) as typeof apiRequest)
}
