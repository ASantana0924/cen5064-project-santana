import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { apiRequest } from './client'
import { useTaskRecordAction } from './tasks'
import type { Check, CheckType, FailCheckInput, PassCheckInput, RecordTestRunInput, TestRun } from './types'

export const testRunKeys = {
  /**
   * The test run list. It includes when the task's latest run was recorded, so
   * the list is fetched again whenever the task details show a newer run, such
   * as after one is recorded here or in another browser.
   */
  list: (taskId: string, latestRecordedAt: string | null) => ['tasks', taskId, 'test-runs', latestRecordedAt] as const,
}

function taskPath(taskId: string): string {
  return `/api/tasks/${encodeURIComponent(taskId)}`
}

/** UC-11: marks the check PASSED. The server refuses it without evidence. */
export function passCheck(taskId: string, type: CheckType, input: PassCheckInput): Promise<Check> {
  return apiRequest<Check>(`${taskPath(taskId)}/checks/${type}/pass`, { method: 'POST', body: JSON.stringify(input) })
}

/** UC-12: marks the check FAILED and clears every approval. The server refuses it without notes. */
export function failCheck(taskId: string, type: CheckType, input: FailCheckInput): Promise<Check> {
  return apiRequest<Check>(`${taskPath(taskId)}/checks/${type}/fail`, { method: 'POST', body: JSON.stringify(input) })
}

/** UC-10: every recorded test run, newest first. */
export function listTestRuns(taskId: string): Promise<TestRun[]> {
  return apiRequest<TestRun[]>(`${taskPath(taskId)}/test-runs`)
}

/** UC-10: records a test run as evidence for the TESTING check. It never changes a check. */
export function recordTestRun(taskId: string, input: RecordTestRunInput): Promise<TestRun> {
  return apiRequest<TestRun>(`${taskPath(taskId)}/test-runs`, { method: 'POST', body: JSON.stringify(input) })
}

/** Marks a check passed, then fetches the task again to show it. */
export function usePassCheck(taskId: string) {
  return useTaskRecordAction(taskId, ({ type, ...input }: PassCheckInput & { type: CheckType }) =>
    passCheck(taskId, type, input),
  )
}

/** Marks a check failed, then fetches the task again to show it and the cleared approvals. */
export function useFailCheck(taskId: string) {
  return useTaskRecordAction(taskId, ({ type, ...input }: FailCheckInput & { type: CheckType }) =>
    failCheck(taskId, type, input),
  )
}

/**
 * The test runs of a task. latestRecordedAt comes from the task details;
 * nothing is fetched while the task has no test runs.
 */
export function useTestRuns(taskId: string, latestRecordedAt: string | null) {
  return useQuery({
    queryKey: testRunKeys.list(taskId, latestRecordedAt),
    queryFn: () => listTestRuns(taskId),
    enabled: latestRecordedAt !== null,
    // Keeps showing the old list while the list with a new run loads, instead of flashing a loading state.
    placeholderData: keepPreviousData,
  })
}

/** Records a test run, then fetches the task again, whose latest run changes the list's key. */
export function useRecordTestRun(taskId: string) {
  return useTaskRecordAction(taskId, (input: RecordTestRunInput) => recordTestRun(taskId, input))
}
