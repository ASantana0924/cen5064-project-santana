import type { Artifact, ArtifactSummary, Check, CheckType, TaskDetails, TaskSummary } from '@/api/types'

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
    latestTestRun: null,
    approvals: [],
    requiredApprovals: 2,
    editable: true,
    canStart: false,
    canApprove: false,
    ...overrides,
  }
}

export function artifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    version: 1,
    prompt: 'Write a Java method that locks an account after 5 failed logins.',
    aiTool: 'Claude',
    codeContent: 'boolean isLocked(int failures) {\n  return failures >= 5;\n}',
    recordedBy: 'alex',
    createdAt: '2026-10-12T09:15:00Z',
    ...overrides,
  }
}

/** The history row of an artifact, as GET /api/tasks/{id}/artifacts returns it. */
export function artifactSummary(overrides: Partial<ArtifactSummary> = {}): ArtifactSummary {
  const { version, aiTool, recordedBy, createdAt } = artifact(overrides)
  return { version, aiTool, recordedBy, createdAt }
}
