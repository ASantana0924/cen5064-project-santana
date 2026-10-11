package verifai.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import verifai.data.InMemoryTaskRepository;
import verifai.data.TaskRepository;
import verifai.domain.Approval;
import verifai.domain.AuditEntry;
import verifai.domain.AuditEventType;
import verifai.domain.Task;
import verifai.domain.TaskStatus;
import verifai.domain.VerificationStatus;
import verifai.domain.VerificationType;

class ApprovalServiceTest {

    private final TaskRepository repository = new InMemoryTaskRepository();
    private final ApprovalService service = new ApprovalService(repository);

    private static Task startedTask() {
        Task task = new Task("Add login check", "Validate usernames", "ASantana0924");
        task.addRequirement("Blank usernames are rejected", "ASantana0924");
        task.addAcceptanceCriterion("Submitting a blank username shows an error", "ASantana0924");
        task.start("ASantana0924");
        return task;
    }

    private static Task readyTask() {
        Task task = startedTask();
        for (VerificationType type : VerificationType.values()) {
            task.markCheckPassed(type, "Checked", "dquin144");
        }
        return task;
    }

    private Task storedReadyTask() {
        return repository.save(readyTask());
    }

    private Task storedApprovedTask() {
        Task task = storedReadyTask();
        service.approve(task.getId(), "dquin144");
        service.approve(task.getId(), "ASantana0924");
        return task;
    }

    @Test
    void firstApprovalKeepsTaskInProgress() {
        Task task = storedReadyTask();

        Approval approval = service.approve(task.getId(), "dquin144");

        assertEquals("dquin144", approval.getDeveloper());
        assertEquals(TaskStatus.IN_PROGRESS, task.getStatus());
        assertEquals(1, task.getApprovals().size());
    }

    @Test
    void secondApprovalFromAnotherDeveloperApprovesTask() {
        Task task = storedApprovedTask();

        assertEquals(TaskStatus.APPROVED, task.getStatus());
        assertEquals(2, task.getApprovals().size());
    }

    @Test
    void approveIsRejectedUntilAllChecksPass() {
        Task task = repository.save(startedTask());

        assertThrows(IllegalStateException.class, () -> service.approve(task.getId(), "dquin144"));
        assertTrue(task.getApprovals().isEmpty());
    }

    @Test
    void sameDeveloperCannotApproveTwice() {
        Task task = storedReadyTask();
        service.approve(task.getId(), "dquin144");

        assertThrows(IllegalStateException.class, () -> service.approve(task.getId(), "dquin144"));
        assertEquals(TaskStatus.IN_PROGRESS, task.getStatus());
        assertEquals(1, task.getApprovals().size());
    }

    @Test
    void reopenReturnsTaskToInProgressAndResetsChecksAndApprovals() {
        Task task = storedApprovedTask();

        AuditEntry entry = service.reopen(task.getId(), "dquin144", "Found a missed edge case");

        assertEquals(AuditEventType.TASK_REOPENED, entry.getEventType());
        assertTrue(entry.getDetails().contains("Found a missed edge case"));
        assertEquals(TaskStatus.IN_PROGRESS, task.getStatus());
        assertTrue(task.getApprovals().isEmpty());
        assertTrue(task.getVerifications().stream().allMatch(c -> c.getStatus() == VerificationStatus.PENDING));
    }

    @Test
    void reopenNeedsAReasonAndAnApprovedTask() {
        Task approved = storedApprovedTask();
        Task inProgress = storedReadyTask();

        assertThrows(IllegalArgumentException.class, () -> service.reopen(approved.getId(), "dquin144", " "));
        assertThrows(IllegalStateException.class, () -> service.reopen(inProgress.getId(), "dquin144", "Recheck"));
        assertEquals(TaskStatus.APPROVED, approved.getStatus());
    }

    @Test
    void auditHistoryKeepsOldApprovalsAndTheReopenReasonInOrder() {
        Task task = storedApprovedTask();
        service.reopen(task.getId(), "dquin144", "Found a missed edge case");

        List<AuditEntry> history = service.getAuditHistory(task.getId());
        List<AuditEventType> lastFive = history.subList(history.size() - 5, history.size())
                .stream().map(AuditEntry::getEventType).toList();

        assertEquals(List.of(AuditEventType.APPROVAL_RECORDED, AuditEventType.APPROVAL_RECORDED,
                AuditEventType.TASK_APPROVED, AuditEventType.TASK_REOPENED, AuditEventType.CHECKS_RESET), lastFive);
        assertEquals(AuditEventType.TASK_CREATED, history.get(0).getEventType());
        assertTrue(history.get(history.size() - 2).getDetails().contains("dquin144, ASantana0924"));
    }

    @Test
    void unknownTaskIdIsRejectedForEveryMethod() {
        UUID unknown = UUID.randomUUID();
        assertThrows(NoSuchElementException.class, () -> service.approve(unknown, "dquin144"));
        assertThrows(NoSuchElementException.class, () -> service.reopen(unknown, "dquin144", "Recheck"));
        assertThrows(NoSuchElementException.class, () -> service.getAuditHistory(unknown));
    }

    @Test
    void approvalIsSavedBackSoAJpaRepositoryWouldKeepIt() {
        TaskRepository mocked = mock(TaskRepository.class);
        Task task = readyTask();
        when(mocked.findById(task.getId())).thenReturn(Optional.of(task));

        new ApprovalService(mocked).approve(task.getId(), "dquin144");

        verify(mocked).save(task);
    }

    @Test
    void rejectedApprovalIsNotSaved() {
        TaskRepository mocked = mock(TaskRepository.class);
        Task task = startedTask();
        when(mocked.findById(task.getId())).thenReturn(Optional.of(task));

        assertThrows(IllegalStateException.class, () -> new ApprovalService(mocked).approve(task.getId(), "dquin144"));

        verify(mocked, never()).save(any());
    }
}