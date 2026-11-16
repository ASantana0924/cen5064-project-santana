import type { MockedFunction } from 'vitest'

import { ApiError, type apiRequest } from '@/api/client'
import type { ApprovalResult, AuditEntry, AuditEventType, TaskDetails } from '@/api/types'
import { pendingChecks } from '@/test/fixtures'
import { routeApi, type Reply } from '@/test/routeApi'

/**
 * A fake backend for one task's approvals, reopening, and audit history. It
 * follows the Domain: approving needs canApprove and a developer who has not
 * approved yet (ignoring case), the last required approval makes the task
 * APPROVED, and reopening needs a reason and an APPROVED task. Each change
 * adds the audit entries the Domain would. extraRoutes can replace any route.
 */
export function fakeApprovalServer(
  api: MockedFunction<typeof apiRequest>,
  initial: TaskDetails,
  initialAudit: AuditEntry[] = [],
  extraRoutes: Record<string, Reply> = {},
) {
  let task = initial
  const audit = [...initialAudit]
  const url = `/api/tasks/${task.id}`
  let minute = 0

  function record(eventType: AuditEventType, developer: string, details: string) {
    minute += 1
    audit.push({ eventType, developer, details, recordedAt: `2026-10-13T10:${String(minute).padStart(2, '0')}:00Z` })
  }

  function approverNames(): string {
    return task.approvals.map((approval) => approval.developer).join(', ')
  }

  routeApi(api, {
    [`GET ${url}`]: async () => task,
    [`GET ${url}/audit`]: async () => [...audit],
    [`POST ${url}/approvals`]: async (init?: RequestInit) => {
      const { developer } = JSON.parse(String(init?.body)) as { developer: string }
      if (task.status !== 'IN_PROGRESS') {
        throw new ApiError(409, 'Only an IN_PROGRESS task can be approved')
      }
      if (!task.canApprove) {
        throw new ApiError(409, 'All six checks must be PASSED before approval')
      }
      if (task.approvals.some((approval) => approval.developer.toLowerCase() === developer.toLowerCase())) {
        throw new ApiError(409, `${developer} has already approved this task`)
      }
      const approval = { developer, approvedAt: `2026-10-13T11:0${task.approvals.length}:00Z` }
      task = { ...task, approvals: [...task.approvals, approval] }
      const count = task.approvals.length
      record('APPROVAL_RECORDED', developer, `${count} of ${task.requiredApprovals} approvals`)
      if (count >= task.requiredApprovals) {
        task = { ...task, status: 'APPROVED', editable: false, canApprove: false }
        record('TASK_APPROVED', developer, `Approved by ${approverNames()}`)
      }
      const result: ApprovalResult = {
        approval,
        approvalCount: count,
        requiredApprovals: task.requiredApprovals,
        progress: `${count} of ${task.requiredApprovals}`,
        taskStatus: task.status,
      }
      return result
    },
    [`POST ${url}/reopen`]: async (init?: RequestInit) => {
      const { developer, reason } = JSON.parse(String(init?.body)) as { developer: string; reason: string }
      if (!reason || reason.trim() === '') {
        throw new ApiError(400, 'A reason is required to reopen a task')
      }
      if (task.status !== 'APPROVED') {
        throw new ApiError(409, 'Only an APPROVED task can be reopened')
      }
      record('TASK_REOPENED', developer, `Reason: ${reason.trim()}. Previous approvals: ${approverNames()}`)
      record('CHECKS_RESET', developer, 'Task reopened')
      task = { ...task, status: 'IN_PROGRESS', editable: true, canApprove: false, checks: pendingChecks(), approvals: [] }
      return task
    },
    ...extraRoutes,
  })
  return { url, current: () => task }
}
