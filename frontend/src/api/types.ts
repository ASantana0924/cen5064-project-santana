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
 * TaskDetailsResponse: GET /api/tasks/{id}. The action flags are computed by
 * the Domain; the frontend only uses them to show or disable buttons.
 */
export interface TaskDetails {
  id: string
  title: string
  description: string
  owner: string
  status: TaskStatus
  requirements: string[]
  acceptanceCriteria: string[]
  checks: Check[]
  artifactCount: number
  approvals: Approval[]
  requiredApprovals: number
  editable: boolean
  canStart: boolean
  canApprove: boolean
}

/** CreateTaskRequest: body of POST /api/tasks. The developer becomes the owner. */
export interface CreateTaskInput {
  title: string
  description: string
  developer: string
}

/** ErrorResponse: body of every error from the backend. */
export interface ApiErrorBody {
  status: number
  error: string
  message: string
}
