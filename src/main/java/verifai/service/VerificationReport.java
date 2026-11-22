package verifai.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import verifai.domain.Approval;
import verifai.domain.Artifact;
import verifai.domain.AuditEntry;
import verifai.domain.Task;
import verifai.domain.TaskItem;
import verifai.domain.TaskStatus;
import verifai.domain.TestRun;
import verifai.domain.Verification;

/**
 * Everything in one task's verification record, as it was when the report was
 * made (UC-18). It holds copies of the task's values and lists, not the Task,
 * so whoever formats the report can read it but cannot change the task. Lists
 * keep the task's order: checks in VerificationType order, and requirements,
 * criteria, test runs, artifacts, approvals, and audit entries oldest first.
 */
public record VerificationReport(
        UUID taskId,
        String title,
        String description,
        String owner,
        TaskStatus status,
        int requiredApprovals,
        List<TaskItem> requirements,
        List<TaskItem> acceptanceCriteria,
        List<Verification> checks,
        List<TestRun> testRuns,
        List<Artifact> artifacts,
        List<Approval> approvals,
        List<AuditEntry> auditHistory,
        Instant generatedAt) {

    public VerificationReport {
        requirements = List.copyOf(requirements);
        acceptanceCriteria = List.copyOf(acceptanceCriteria);
        checks = List.copyOf(checks);
        testRuns = List.copyOf(testRuns);
        artifacts = List.copyOf(artifacts);
        approvals = List.copyOf(approvals);
        auditHistory = List.copyOf(auditHistory);
    }

    static VerificationReport of(Task task, Instant generatedAt) {
        return new VerificationReport(task.getId(), task.getTitle(), task.getDescription(), task.getOwner(),
                task.getStatus(), task.getRequiredApprovals(), task.getRequirements(), task.getAcceptanceCriteria(),
                task.getVerifications(), task.getTestRuns(), task.getArtifacts(), task.getApprovals(),
                task.getAuditHistory(), generatedAt);
    }
}
