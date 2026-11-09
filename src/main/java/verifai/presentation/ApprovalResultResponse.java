package verifai.presentation;

import verifai.domain.Approval;
import verifai.domain.Task;

/**
 * Body returned after an approval (UC-14): the new approval and where the task
 * stands, such as "1 of 2" while it stays IN_PROGRESS, or "2 of 2" once APPROVED.
 */
public record ApprovalResultResponse(
        ApprovalResponse approval,
        int approvalCount,
        int requiredApprovals,
        String progress,
        String taskStatus) {

    static ApprovalResultResponse from(Approval approval, Task task) {
        int count = task.getApprovals().size();
        return new ApprovalResultResponse(
                ApprovalResponse.from(approval),
                count,
                task.getRequiredApprovals(),
                count + " of " + task.getRequiredApprovals(),
                task.getStatus().name());
    }
}
