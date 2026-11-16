import { useQuery } from '@tanstack/react-query'

import { apiRequest } from './client'
import { taskKeys, useTaskAction, useTaskRecordAction } from './tasks'
import type { ApprovalResult, AuditEntry, TaskDetails } from './types'

function taskPath(taskId: string): string {
  return `/api/tasks/${encodeURIComponent(taskId)}`
}

/** UC-14: records the developer's approval. The last required approval makes the task APPROVED. */
export function approveTask(taskId: string, developer: string): Promise<ApprovalResult> {
  return apiRequest<ApprovalResult>(`${taskPath(taskId)}/approvals`, {
    method: 'POST',
    body: JSON.stringify({ developer }),
  })
}

/** UC-15: returns an APPROVED task to IN_PROGRESS with every check PENDING and no approvals. A reason is required. */
export function reopenTask(taskId: string, developer: string, reason: string): Promise<TaskDetails> {
  return apiRequest<TaskDetails>(`${taskPath(taskId)}/reopen`, {
    method: 'POST',
    body: JSON.stringify({ developer, reason }),
  })
}

/** UC-16: every audit entry for the task, oldest first. */
export function getAuditHistory(taskId: string): Promise<AuditEntry[]> {
  return apiRequest<AuditEntry[]>(`${taskPath(taskId)}/audit`)
}

/** Approves the task, then fetches it again to show the new count and, after the last approval, APPROVED. */
export function useApproveTask(taskId: string) {
  return useTaskRecordAction(taskId, (developer: string) => approveTask(taskId, developer))
}

/** Reopens the task. The answer is the task, so it replaces the cached details. */
export function useReopenTask(taskId: string) {
  return useTaskAction(taskId, ({ developer, reason }: { developer: string; reason: string }) =>
    reopenTask(taskId, developer, reason),
  )
}

/** The audit history. Every task action marks it stale, so it refreshes after each change. */
export function useAuditHistory(taskId: string) {
  return useQuery({ queryKey: taskKeys.audit(taskId), queryFn: () => getAuditHistory(taskId) })
}
