import type { Check, CheckType, TaskDetails, TaskSummary } from '@/api/types'

const checkTypes: CheckType[] = ['REQUIREMENTS', 'FUNCTIONALITY', 'TESTING', 'ARCHITECTURE', 'CODE_QUALITY', 'SECURITY']

export function pendingChecks(): Check[] {
  return checkTypes.map((type) => ({
    type,
    status: 'PENDING',
    evidence: null,
    notes: null,
    reviewer: null,
    reviewedOn: null,
  }))
}

export function summary(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Rate limit login attempts',
    owner: 'sam',
    status: 'IN_PROGRESS',
    passedChecks: 3,
    totalChecks: 6,
    approvalCount: 1,
    requiredApprovals: 2,
    ...overrides,
  }
}

export function details(overrides: Partial<TaskDetails> = {}): TaskDetails {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Rate limit login attempts',
    description: 'Lock an account for 15 minutes after 5 failed logins.',
    owner: 'sam',
    status: 'DRAFT',
    requirements: [],
    acceptanceCriteria: [],
    checks: pendingChecks(),
    artifactCount: 0,
    approvals: [],
    requiredApprovals: 2,
    editable: true,
    canStart: false,
    canApprove: false,
    ...overrides,
  }
}
