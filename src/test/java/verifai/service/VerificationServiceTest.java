package verifai.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import verifai.data.InMemoryTaskRepository;
import verifai.data.TaskRepository;
import verifai.domain.Task;
import verifai.domain.Verification;
import verifai.domain.VerificationStatus;
import verifai.domain.VerificationType;

class VerificationServiceTest {

    private final TaskRepository repository = new InMemoryTaskRepository();
    private final VerificationService service = new VerificationService(repository);

    private static Task startedTask() {
        Task task = new Task("Add login check", "Validate usernames", "ASantana0924");
        task.addRequirement("Blank usernames are rejected", "ASantana0924");
        task.addAcceptanceCriterion("Submitting a blank username shows an error", "ASantana0924");
        task.start("ASantana0924");
        return task;
    }

    private Task storedStartedTask() {
        return repository.save(startedTask());
    }

    @Test
    void markPassedStoresEvidenceAndReviewer() {
        Task task = storedStartedTask();

        Verification check = service.markPassed(task.getId(), VerificationType.TESTING, "All 12 tests pass", "dquin144");

        assertEquals(VerificationStatus.PASSED, check.getStatus());
        assertEquals("All 12 tests pass", check.getEvidence());
        assertEquals("dquin144", check.getReviewer());
        assertEquals(VerificationStatus.PASSED, service.getCheck(task.getId(), VerificationType.TESTING).getStatus());
    }

    @Test
    void markFailedStoresNotesAndReviewer() {
        Task task = storedStartedTask();

        Verification check = service.markFailed(task.getId(), VerificationType.SECURITY, "Password is logged", "dquin144");

        assertEquals(VerificationStatus.FAILED, check.getStatus());
        assertEquals("Password is logged", check.getNotes());
        assertEquals("dquin144", check.getReviewer());
    }

    @Test
    void markFailedClearsApprovals() {
        Task task = storedStartedTask();
        for (VerificationType type : VerificationType.values()) {
            service.markPassed(task.getId(), type, "Checked", "dquin144");
        }
        task.approve("dquin144");

        service.markFailed(task.getId(), VerificationType.ARCHITECTURE, "Controller calls the repository", "ASantana0924");

        assertTrue(task.getApprovals().isEmpty());
    }

    @Test
    void passWithoutEvidenceOrFailWithoutNotesIsRejected() {
        Task task = storedStartedTask();

        assertThrows(IllegalArgumentException.class,
                () -> service.markPassed(task.getId(), VerificationType.TESTING, " ", "dquin144"));
        assertThrows(IllegalArgumentException.class,
                () -> service.markFailed(task.getId(), VerificationType.TESTING, " ", "dquin144"));

        assertEquals(VerificationStatus.PENDING, service.getCheck(task.getId(), VerificationType.TESTING).getStatus());
    }

    @Test
    void checksOnDraftTaskAreRejected() {
        Task draft = repository.save(new Task("Add login check", "", "ASantana0924"));

        assertThrows(IllegalStateException.class,
                () -> service.markPassed(draft.getId(), VerificationType.TESTING, "Tests pass", "dquin144"));
        assertThrows(IllegalStateException.class,
                () -> service.markFailed(draft.getId(), VerificationType.TESTING, "Tests fail", "dquin144"));
    }

    @Test
    void listChecksReturnsAllSixInTypeOrder() {
        Task task = storedStartedTask();
        service.markPassed(task.getId(), VerificationType.REQUIREMENTS, "Matches the spec", "dquin144");

        List<Verification> checks = service.listChecks(task.getId());

        assertEquals(Arrays.asList(VerificationType.values()), checks.stream().map(Verification::getType).toList());
        assertEquals(VerificationStatus.PASSED, checks.get(0).getStatus());
        assertEquals(VerificationStatus.PENDING, checks.get(1).getStatus());
    }

    @Test
    void unknownTaskIdIsRejectedForEveryMethod() {
        UUID unknown = UUID.randomUUID();
        assertThrows(NoSuchElementException.class,
                () -> service.markPassed(unknown, VerificationType.TESTING, "Tests pass", "dquin144"));
        assertThrows(NoSuchElementException.class,
                () -> service.markFailed(unknown, VerificationType.TESTING, "Tests fail", "dquin144"));
        assertThrows(NoSuchElementException.class, () -> service.listChecks(unknown));
        assertThrows(NoSuchElementException.class, () -> service.getCheck(unknown, VerificationType.TESTING));
    }

    @Test
    void markedCheckIsSavedBackSoAJpaRepositoryWouldKeepIt() {
        TaskRepository mocked = mock(TaskRepository.class);
        Task task = startedTask();
        when(mocked.findById(task.getId())).thenReturn(Optional.of(task));

        new VerificationService(mocked).markPassed(task.getId(), VerificationType.TESTING, "Tests pass", "dquin144");

        verify(mocked).save(task);
    }

    @Test
    void rejectedCheckIsNotSaved() {
        TaskRepository mocked = mock(TaskRepository.class);
        Task draft = new Task("Add login check", "", "ASantana0924");
        when(mocked.findById(draft.getId())).thenReturn(Optional.of(draft));

        assertThrows(IllegalStateException.class,
                () -> new VerificationService(mocked).markFailed(draft.getId(), VerificationType.TESTING, "Tests fail", "dquin144"));

        verify(mocked, never()).save(any());
    }
}