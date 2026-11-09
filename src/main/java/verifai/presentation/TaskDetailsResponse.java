package verifai.presentation;

import java.util.List;
import java.util.UUID;

import verifai.domain.Task;

/**
 * Full view of one task (UC-06). The action flags come from Task, so the
 * frontend shows or disables buttons without deciding any rule itself.
 * latestTestRun is null when no test run has been recorded.
 */
public record TaskDetailsResponse(
        UUID id,
        String title,
        String description,
        String owner,
        String status,
        List<String> requirements,
        List<String> acceptanceCriteria,
        List<CheckResponse> checks,
        int artifactCount,
        TestRunResponse latestTestRun,
        List<ApprovalResponse> approvals,
        int requiredApprovals,
        boolean editable,
        boolean canStart,
        boolean canApprove) {

    static TaskDetailsResponse from(Task task) {
        return new TaskDetailsResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getOwner(),
                task.getStatus().name(),
                task.getRequirements(),
                task.getAcceptanceCriteria(),
                task.getVerifications().stream().map(CheckResponse::from).toList(),
                task.getArtifacts().size(),
                task.getLatestTestRun().map(TestRunResponse::from).orElse(null),
                task.getApprovals().stream().map(ApprovalResponse::from).toList(),
                task.getRequiredApprovals(),
                task.isEditable(),
                task.canStart(),
                task.canApprove());
    }
}
