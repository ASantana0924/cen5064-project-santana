import type {
  Artifact,
  ArtifactSummary,
  AuditEntry,
  Check,
  CheckType,
  TaskDetails,
  TaskItem,
  TaskSummary,
  TestRun,
} from '@/api/types'

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

/** All six checks PASSED by dana, as on a task that is ready to approve. */
export function passedChecks(): Check[] {
  return checkTypes.map((type) => ({
    type,
    status: 'PASSED',
    evidence: `Reviewed ${type.toLowerCase()}`,
    notes: null,
    reviewer: 'dana',
    reviewedOn: '2026-10-11',
  }))
}

/** A requirement or acceptance criterion. Its id comes from its text, such as "item-count-failed-logins", so tests can name it. */
export function item(text: string): TaskItem {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return { id: `item-${slug}`, text }
}

export function items(...texts: string[]): TaskItem[] {
  return texts.map(item)
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

export function testRun(overrides: Partial<TestRun> = {}): TestRun {
  return {
    tool: 'JUnit',
    total: 14,
    passed: 12,
    failed: 1,
    skipped: 1,
    summary: '1 failure in LoginCheckTest',
    recordedBy: 'alex',
    recordedAt: '2026-10-12T10:00:00Z',
    artifactVersion: 1,
    ...overrides,
  }
}

export function auditEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    eventType: 'TASK_CREATED',
    developer: 'sam',
    details: 'Rate limit login attempts',
    recordedAt: '2026-10-10T09:00:00Z',
    ...overrides,
  }
}
