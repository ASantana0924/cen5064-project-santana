package verifai.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import verifai.data.InMemoryTaskRepository;
import verifai.data.TaskRepository;
import verifai.domain.Approval;
import verifai.domain.Artifact;
import verifai.domain.AuditEventType;
import verifai.domain.Task;
import verifai.domain.TaskItem;
import verifai.domain.TaskStatus;
import verifai.domain.Verification;
import verifai.domain.VerificationStatus;
import verifai.domain.VerificationType;

class ReportServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-22T14:03:27.456Z");

    private final TaskRepository repository = new InMemoryTaskRepository();
    private final ReportService service = new ReportService(repository, Clock.fixed(NOW, ZoneOffset.UTC));

    /** An APPROVED task with two artifact versions, two test runs, six passed checks, and two approvals. */
    private Task approvedTask() {
        Task task = new Task("Rate limit login attempts", "Lock an account after 5 failed logins.", "sam");
        task.addRequirement("Count failed logins per account", "sam");
        task.addAcceptanceCriterion("The sixth failed login is refused", "sam");
        task.start("sam");
        task.recordTestRun("JUnit", 3, 2, 0, "Before any artifact", "sam");
        task.recordArtifact("Write a rate limiter", "Claude", "class LoginRateLimiter {}", "sam");
        task.recordArtifact("Make it thread-safe", "ChatGPT", "class LoginRateLimiter { /* v2 */ }", "sam");
        task.recordTestRun("JUnit", 8, 8, 0, "All pass", "sam");
        for (VerificationType type : VerificationType.values()) {
            task.markCheckPassed(type, "Reviewed " + type, "dana");
        }
        task.approve("alex");
        task.approve("dana");
        return repository.save(task);
    }

    @Test
    void theReportHoldsEveryPartOfTheTaskRecord() {
        Task task = approvedTask();

        VerificationReport report = service.getReport(task.getId());

        assertEquals(task.getId(), report.taskId());
        assertEquals("Rate limit login attempts", report.title());
        assertEquals("Lock an account after 5 failed logins.", report.description());
        assertEquals("sam", report.owner());
        assertEquals(TaskStatus.APPROVED, report.status());
        assertEquals(2, report.requiredApprovals());
        assertEquals(List.of("Count failed logins per account"),
                report.requirements().stream().map(TaskItem::text).toList());
        assertEquals(List.of("The sixth failed login is refused"),
                report.acceptanceCriteria().stream().map(TaskItem::text).toList());
        assertEquals(List.of(VerificationType.values()), report.checks().stream().map(Verification::getType).toList());
        assertTrue(report.checks().stream().allMatch(check -> check.getStatus() == VerificationStatus.PASSED));
        assertEquals(List.of("Before any artifact", "All pass"),
                report.testRuns().stream().map(run -> run.getSummary()).toList());
        assertEquals(List.of(1, 2), report.artifacts().stream().map(Artifact::getVersion).toList());
        assertEquals(task.getAuditHistory().size(), report.auditHistory().size());
        assertEquals(AuditEventType.TASK_CREATED, report.auditHistory().get(0).getEventType());
    }

    @Test
    void theReportOfAnApprovedTaskListsBothApprovers() {
        Task task = approvedTask();

        VerificationReport report = service.getReport(task.getId());

        assertEquals(List.of("alex", "dana"), report.approvals().stream().map(Approval::getDeveloper).toList());
    }

    @Test
    void aTaskWithNoArtifactsGivesEmptyListsAndPendingChecks() {
        Task task = repository.save(new Task("Add password reset email", "", "alex"));

        VerificationReport report = service.getReport(task.getId());

        assertEquals(TaskStatus.DRAFT, report.status());
        assertEquals(List.of(), report.artifacts());
        assertEquals(List.of(), report.testRuns());
        assertEquals(List.of(), report.approvals());
        assertEquals(List.of(), report.requirements());
        assertEquals(6, report.checks().size());
        assertTrue(report.checks().stream().allMatch(check -> check.getStatus() == VerificationStatus.PENDING));
        assertEquals(List.of(AuditEventType.TASK_CREATED),
                report.auditHistory().stream().map(e -> e.getEventType()).toList());
    }

    @Test
    void theReportIsStampedWithTheCurrentTimeToTheSecond() {
        Task task = approvedTask();

        assertEquals(Instant.parse("2026-11-22T14:03:27Z"), service.getReport(task.getId()).generatedAt());
    }

    @Test
    void anUnknownTaskIdThrowsNoSuchElementException() {
        UUID unknown = UUID.randomUUID();

        NoSuchElementException ex = assertThrows(NoSuchElementException.class, () -> service.getReport(unknown));
        assertEquals("No task with id " + unknown, ex.getMessage());
    }

    @Test
    void makingAReportNeverSavesTheTask() {
        TaskRepository tasks = mock(TaskRepository.class);
        Task task = new Task("Add login check", "", "alex");
        when(tasks.findById(task.getId())).thenReturn(Optional.of(task));

        new ReportService(tasks, Clock.fixed(NOW, ZoneOffset.UTC)).getReport(task.getId());

        verify(tasks, never()).save(any());
    }

    @Test
    void theReportListsCannotBeChanged() {
        VerificationReport report = service.getReport(approvedTask().getId());

        assertThrows(UnsupportedOperationException.class, () -> report.approvals().clear());
        assertThrows(UnsupportedOperationException.class, () -> report.auditHistory().clear());
        assertThrows(UnsupportedOperationException.class, () -> report.artifacts().clear());
    }
}
