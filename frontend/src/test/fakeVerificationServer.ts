import type { MockedFunction } from 'vitest'

import type { apiRequest } from '@/api/client'
import type { Check, CheckType, TaskDetails, TestRun } from '@/api/types'
import { routeApi, type Reply } from '@/test/routeApi'

const checkTypes: CheckType[] = ['REQUIREMENTS', 'FUNCTIONALITY', 'TESTING', 'ARCHITECTURE', 'CODE_QUALITY', 'SECURITY']

const TODAY = '2026-10-13'

/**
 * A fake backend for one task's checks and test runs. GET returns the current
 * task and runs. Passing and failing a check change it the way the Domain
 * does: failing clears every approval. Recording a test run adds it and
 * changes no check. extraRoutes can replace any route, such as with an error.
 */
export function fakeVerificationServer(
  api: MockedFunction<typeof apiRequest>,
  initial: TaskDetails,
  initialRuns: TestRun[] = [],
  extraRoutes: Record<string, Reply> = {},
) {
  let task = initial
  const runs = [...initialRuns]
  const url = `/api/tasks/${task.id}`

  function review(type: CheckType, change: Partial<Check>, clearApprovals: boolean): Check {
    task = {
      ...task,
      checks: task.checks.map((check) => (check.type === type ? { ...check, ...change, reviewedOn: TODAY } : check)),
      approvals: clearApprovals ? [] : task.approvals,
    }
    return task.checks.find((check) => check.type === type) as Check
  }

  const routes: Record<string, Reply> = {
    [`GET ${url}`]: async () => task,
    [`GET ${url}/test-runs`]: async () => [...runs],
    [`POST ${url}/test-runs`]: async (init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        tool: string
        total: number
        passed: number
        failed: number
        summary: string
        developer: string
      }
      const run: TestRun = {
        tool: body.tool,
        total: body.total,
        passed: body.passed,
        failed: body.failed,
        skipped: body.total - body.passed - body.failed,
        summary: body.summary,
        recordedBy: body.developer,
        recordedAt: `2026-10-13T1${runs.length}:00:00Z`,
        artifactVersion: task.artifactCount === 0 ? null : task.artifactCount,
      }
      runs.unshift(run)
      task = { ...task, latestTestRun: run }
      return run
    },
  }
  for (const type of checkTypes) {
    routes[`POST ${url}/checks/${type}/pass`] = async (init?: RequestInit) => {
      const { evidence, reviewer } = JSON.parse(String(init?.body)) as { evidence: string; reviewer: string }
      return review(type, { status: 'PASSED', evidence, notes: null, reviewer }, false)
    }
    routes[`POST ${url}/checks/${type}/fail`] = async (init?: RequestInit) => {
      const { notes, reviewer } = JSON.parse(String(init?.body)) as { notes: string; reviewer: string }
      return review(type, { status: 'FAILED', notes, evidence: null, reviewer }, true)
    }
  }

  routeApi(api, { ...routes, ...extraRoutes })
  return { url, current: () => task }
}
