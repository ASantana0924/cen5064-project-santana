// Types that match the backend DTOs in verifai.presentation. Keep the two in sync.

export type TaskStatus = 'DRAFT' | 'IN_PROGRESS' | 'APPROVED'

export type CheckStatus = 'PENDING' | 'PASSED' | 'FAILED'

export type CheckType =
  | 'REQUIREMENTS'
  | 'FUNCTIONALITY'
  | 'TESTING'
  | 'ARCHITECTURE'
  | 'CODE_QUALITY'
  | 'SECURITY'

/** TaskSummaryResponse: one row of GET /api/tasks. */
export interface TaskSummary {
  id: string
  title: string
  owner: string
  status: TaskStatus
  passedChecks: number
  totalChecks: number
  approvalCount: number
  requiredApprovals: number
}

/** CheckResponse. reviewedOn is an ISO date such as "2026-10-11". */
export interface Check {
  type: CheckType
  status: CheckStatus
  evidence: string | null
  notes: string | null
  reviewer: string | null
  reviewedOn: string | null
}

/** ApprovalResponse. approvedAt is an ISO instant. */
export interface Approval {
  developer: string
  approvedAt: string
}

/**
 * TestRunResponse: one recorded automated test run, evidence for the TESTING
 * check. skipped is total minus passed minus failed. recordedAt is an ISO
 * instant. artifactVersion is null when the task had no artifact yet.
 */
export interface TestRun {
  tool: string
  total: number
  passed: number
  failed: number
  skipped: number
  summary: string
  recordedBy: string
  recordedAt: string
  artifactVersion: number | null
}

/** TaskItemResponse: one requirement or acceptance criterion. A removal names the item by its id. */
export interface TaskItem {
  id: string
  text: string
}

/**
 * TaskDetailsResponse: GET /api/tasks/{id}. The action flags are computed by
 * the Domain; the frontend only uses them to show or disable buttons.
 */
export interface TaskDetails {
  id: string
  title: string
  description: string
  owner: string
  status: TaskStatus
  requirements: TaskItem[]
  acceptanceCriteria: TaskItem[]
  checks: Check[]
  artifactCount: number
  /** null when no test run has been recorded. */
  latestTestRun: TestRun | null
  approvals: Approval[]
  requiredApprovals: number
  editable: boolean
  canStart: boolean
  canApprove: boolean
}

/** ArtifactSummaryResponse: one row of GET /api/tasks/{id}/artifacts, without the prompt and code. createdAt is an ISO instant. */
export interface ArtifactSummary {
  version: number
  aiTool: string
  recordedBy: string
  createdAt: string
}

/** ArtifactResponse: one artifact version in full, from GET /api/tasks/{id}/artifacts/{version}. */
export interface Artifact extends ArtifactSummary {
  prompt: string
  codeContent: string
}

/** RecordArtifactRequest: body of POST /api/tasks/{id}/artifacts. The developer is recorded as the author. */
export interface RecordArtifactInput {
  prompt: string
  aiTool: string
  codeContent: string
  developer: string
}

/** PassCheckRequest: body of POST /api/tasks/{id}/checks/{type}/pass. Evidence is required. */
export interface PassCheckInput {
  evidence: string
  reviewer: string
}

/** FailCheckRequest: body of POST /api/tasks/{id}/checks/{type}/fail. Notes are required. */
export interface FailCheckInput {
  notes: string
  reviewer: string
}

/** RecordTestRunRequest: body of POST /api/tasks/{id}/test-runs. The summary may be empty. */
export interface RecordTestRunInput {
  tool: string
  total: number
  passed: number
  failed: number
  summary: string
  developer: string
}

/** AuditEventType: what an audit entry records. */
export type AuditEventType =
  | 'TASK_CREATED'
  | 'TASK_EDITED'
  | 'TASK_STARTED'
  | 'ARTIFACT_RECORDED'
  | 'TEST_RESULTS_RECORDED'
  | 'CHECK_PASSED'
  | 'CHECK_FAILED'
  | 'CHECKS_RESET'
  | 'APPROVAL_RECORDED'
  | 'TASK_APPROVED'
  | 'TASK_REOPENED'

/** AuditEntryResponse: one entry of GET /api/tasks/{id}/audit. recordedAt is an ISO instant. */
export interface AuditEntry {
  eventType: AuditEventType
  developer: string
  details: string
  recordedAt: string
}

/**
 * ApprovalResultResponse: answer to POST /api/tasks/{id}/approvals. progress
 * reads like "1 of 2"; taskStatus becomes APPROVED with the last approval.
 */
export interface ApprovalResult {
  approval: Approval
  approvalCount: number
  requiredApprovals: number
  progress: string
  taskStatus: TaskStatus
}

/** CreateTaskRequest: body of POST /api/tasks. The developer becomes the owner. */
export interface CreateTaskInput {
  title: string
  description: string
  developer: string
}

/** EditTaskRequest: body of PATCH /api/tasks/{id}. Send both fields; unchanged values are ignored. */
export interface EditTaskInput {
  title: string
  description: string
  developer: string
}

/** The two text lists on a task, named as in TaskDetails. */
export type TaskListName = 'requirements' | 'acceptanceCriteria'

/** ErrorResponse: body of every error from the backend. */
export interface ApiErrorBody {
  status: number
  error: string
  message: string
}
