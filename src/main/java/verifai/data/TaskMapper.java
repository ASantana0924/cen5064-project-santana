package verifai.data;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.dao.OptimisticLockingFailureException;

import verifai.domain.Approval;
import verifai.domain.Artifact;
import verifai.domain.AuditEntry;
import verifai.domain.Task;
import verifai.domain.TestRun;
import verifai.domain.Verification;
import verifai.domain.VerificationType;

/**
 * Converts between the Domain's Task and its stored form, TaskEntity.
 *
 * Loading rebuilds the task with the Domain's restore factories, so no rule
 * runs again and no audit entry is added (ADR-007). Saving copies the task onto
 * the entity: changeable parts are replaced, and only the new artifacts, test
 * runs, and audit entries are added to the append-only lists.
 */
final class TaskMapper {

    private TaskMapper() {
    }

    /** Rebuilds the Domain task from its stored form. */
    static Task toDomain(TaskEntity entity) {
        List<Verification> checks = entity.getChecks().entrySet().stream()
                .map(e -> Verification.restore(e.getKey(), e.getValue().getStatus(), e.getValue().getEvidence(),
                        e.getValue().getNotes(), e.getValue().getReviewer(), e.getValue().getReviewedOn()))
                .toList();
        List<Artifact> artifacts = entity.getArtifacts().stream()
                .map(a -> Artifact.restore(a.getPrompt(), a.getAiTool(), a.getCodeContent(), a.getRecordedBy(),
                        a.getVersion(), a.getCreatedAt()))
                .toList();
        List<TestRun> testRuns = entity.getTestRuns().stream()
                .map(r -> TestRun.restore(r.getTool(), r.getTotal(), r.getPassed(), r.getFailed(), r.getSummary(),
                        r.getRecordedBy(), r.getArtifactVersion(), r.getRecordedAt()))
                .toList();
        List<Approval> approvals = entity.getApprovals().stream()
                .map(a -> Approval.restore(a.getDeveloper(), a.getApprovedAt()))
                .toList();
        List<AuditEntry> audit = entity.getAuditEntries().stream()
                .map(e -> AuditEntry.restore(e.getEventType(), e.getDeveloper(), e.getDetails(), e.getRecordedAt()))
                .toList();
        return Task.restore(entity.getId(), entity.getTitle(), entity.getDescription(), entity.getOwner(),
                entity.getStatus(), entity.getRequiredApprovals(), List.copyOf(entity.getRequirements()),
                List.copyOf(entity.getAcceptanceCriteria()), checks, artifacts, testRuns, approvals, audit);
    }

    /** A new, empty entity for a task that has never been saved. */
    static TaskEntity newEntity(Task task) {
        List<AuditEntry> audit = task.getAuditHistory();
        Instant createdAt = audit.isEmpty()
                ? Instant.now().truncatedTo(ChronoUnit.MICROS)
                : audit.get(0).getRecordedAt();
        return new TaskEntity(task.getId(), task.getOwner(), task.getRequiredApprovals(), createdAt);
    }

    /**
     * Makes the entity match the task.
     *
     * @throws OptimisticLockingFailureException if the stored history is not the
     *         start of the task's history, which means another request saved this
     *         task after it was loaded. Saving would lose that request's changes.
     */
    static void copyToEntity(Task task, TaskEntity entity) {
        requireSameHistory(task, entity);

        entity.setTitle(task.getTitle());
        entity.setDescription(task.getDescription());
        entity.setStatus(task.getStatus());
        replace(entity.getRequirements(), task.getRequirements());
        replace(entity.getAcceptanceCriteria(), task.getAcceptanceCriteria());

        Map<VerificationType, CheckEmbeddable> checks = entity.getChecks();
        for (Verification check : task.getVerifications()) {
            checks.put(check.getType(), new CheckEmbeddable(check.getStatus(), check.getEvidence(),
                    check.getNotes(), check.getReviewer(), check.getReviewedOn()));
        }

        replace(entity.getApprovals(), task.getApprovals().stream()
                .map(a -> new ApprovalEmbeddable(a.getDeveloper(), a.getApprovedAt()))
                .toList());

        List<Artifact> artifacts = task.getArtifacts();
        for (int i = entity.getArtifacts().size(); i < artifacts.size(); i++) {
            Artifact a = artifacts.get(i);
            entity.getArtifacts().add(new ArtifactEntity(entity, a.getVersion(), a.getPrompt(), a.getAiTool(),
                    a.getCodeContent(), a.getRecordedBy(), a.getCreatedAt()));
        }

        List<TestRun> testRuns = task.getTestRuns();
        for (int i = entity.getTestRuns().size(); i < testRuns.size(); i++) {
            TestRun r = testRuns.get(i);
            entity.getTestRuns().add(new TestRunEntity(entity, i, r.getTool(), r.getTotal(), r.getPassed(),
                    r.getFailed(), r.getSummary(), r.getRecordedBy(), r.getRecordedAt(), r.getArtifactVersion()));
        }

        List<AuditEntry> audit = task.getAuditHistory();
        for (int i = entity.getAuditEntries().size(); i < audit.size(); i++) {
            AuditEntry e = audit.get(i);
            entity.getAuditEntries().add(new AuditEntryEntity(entity, i, e.getEventType(), e.getDeveloper(),
                    e.getDetails(), e.getRecordedAt()));
        }
    }

    /*
     * Every change to a task adds an audit entry, so comparing histories finds a
     * lost update. The stored lists must be no longer than the task's, and the
     * last stored audit entry must be the task's entry at the same position.
     */
    private static void requireSameHistory(Task task, TaskEntity entity) {
        List<AuditEntryEntity> stored = entity.getAuditEntries();
        List<AuditEntry> audit = task.getAuditHistory();
        boolean sameHistory = stored.size() <= audit.size()
                && entity.getArtifacts().size() <= task.getArtifacts().size()
                && entity.getTestRuns().size() <= task.getTestRuns().size()
                && (stored.isEmpty() || sameEntry(stored.get(stored.size() - 1), audit.get(stored.size() - 1)));
        if (!sameHistory) {
            throw new OptimisticLockingFailureException(
                    "This task was changed by another request. Reload it and try again.");
        }
    }

    private static boolean sameEntry(AuditEntryEntity stored, AuditEntry entry) {
        return stored.getEventType() == entry.getEventType()
                && stored.getDeveloper().equals(entry.getDeveloper())
                && stored.getDetails().equals(entry.getDetails())
                && stored.getRecordedAt().equals(entry.getRecordedAt());
    }

    /** Changes the list in place, so Hibernate updates only the rows that differ. */
    private static <T> void replace(List<T> stored, List<T> values) {
        if (Objects.equals(stored, values)) {
            return;
        }
        stored.clear();
        stored.addAll(values);
    }
}
