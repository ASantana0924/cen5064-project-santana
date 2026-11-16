import type { AuditEventType, CheckStatus, CheckType, TaskStatus } from '@/api/types'

export const taskStatusLabel: Record<TaskStatus, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In progress',
  APPROVED: 'Approved',
}

export const checkStatusLabel: Record<CheckStatus, string> = {
  PENDING: 'Pending',
  PASSED: 'Passed',
  FAILED: 'Failed',
}

export const checkTypeLabel: Record<CheckType, string> = {
  REQUIREMENTS: 'Requirements',
  FUNCTIONALITY: 'Functionality',
  TESTING: 'Testing',
  ARCHITECTURE: 'Architecture',
  CODE_QUALITY: 'Code quality',
  SECURITY: 'Security',
}

/** Formats an ISO date such as "2026-10-11" without shifting it across time zones. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

/** Formats an ISO instant in the browser's time zone. */
export function formatDateTime(isoInstant: string): string {
  return new Date(isoInstant).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export const auditEventLabel: Record<AuditEventType, string> = {
  TASK_CREATED: 'Task created',
  TASK_EDITED: 'Task edited',
  TASK_STARTED: 'Task started',
  ARTIFACT_RECORDED: 'Artifact recorded',
  TEST_RESULTS_RECORDED: 'Test results recorded',
  CHECK_PASSED: 'Check passed',
  CHECK_FAILED: 'Check failed',
  CHECKS_RESET: 'Checks reset',
  APPROVAL_RECORDED: 'Approval recorded',
  TASK_APPROVED: 'Task approved',
  TASK_REOPENED: 'Task reopened',
}
