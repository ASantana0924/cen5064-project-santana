package verifai.presentation;

import java.util.UUID;

import verifai.domain.Task;
import verifai.domain.VerificationStatus;

/** One row of the task list (UC-05). */
public record TaskSummaryResponse(
        UUID id,
        String title,
        String owner,
        String status,
        int passedChecks,
        int totalChecks,
        int approvalCount,
        int requiredApprovals) {

    static TaskSummaryResponse from(Task task) {
        int passed = (int) task.getVerifications().stream()
                .filter(check -> check.getStatus() == VerificationStatus.PASSED)
                .count();
        return new TaskSummaryResponse(
                task.getId(),
                task.getTitle(),
                task.getOwner(),
                task.getStatus().name(),
                passed,
                task.getVerifications().size(),
                task.getApprovals().size(),
                task.getRequiredApprovals());
    }
}
