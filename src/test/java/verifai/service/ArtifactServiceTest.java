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
import verifai.domain.Artifact;
import verifai.domain.Task;
import verifai.domain.VerificationStatus;
import verifai.domain.VerificationType;

class ArtifactServiceTest {

    private final TaskRepository repository = new InMemoryTaskRepository();
    private final ArtifactService service = new ArtifactService(repository);

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
    void firstArtifactIsVersionOneAndStoredOnTheTask() {
        Task task = storedStartedTask();

        Artifact artifact = service.recordArtifact(task.getId(), "Write a username check", "Claude", "code v1", "ASantana0924");

        assertEquals(1, artifact.getVersion());
        assertEquals(List.of(artifact), repository.findById(task.getId()).orElseThrow().getArtifacts());
    }

    @Test
    void revisedArtifactGetsNextVersionAndResetsChecks() {
        Task task = storedStartedTask();
        service.recordArtifact(task.getId(), "Write a username check", "Claude", "code v1", "ASantana0924");
        task.markCheckPassed(VerificationType.TESTING, "All tests pass", "dquin144");

        Artifact revised = service.recordArtifact(task.getId(), "Also trim spaces", "Claude", "code v2", "dquin144");

        assertEquals(2, revised.getVersion());
        assertEquals(VerificationStatus.PENDING, task.getVerification(VerificationType.TESTING).getStatus());
    }

    @Test
    void recordOnDraftTaskIsRejectedAndNothingIsRecorded() {
        Task draft = repository.save(new Task("Add login check", "", "ASantana0924"));

        assertThrows(IllegalStateException.class,
                () -> service.recordArtifact(draft.getId(), "Prompt", "Claude", "code", "ASantana0924"));

        assertTrue(service.listVersions(draft.getId()).isEmpty());
    }

    @Test
    void blankFieldsAreRejectedAndNothingIsRecorded() {
        Task task = storedStartedTask();

        assertThrows(IllegalArgumentException.class,
                () -> service.recordArtifact(task.getId(), " ", "Claude", "code", "ASantana0924"));
        assertThrows(IllegalArgumentException.class,
                () -> service.recordArtifact(task.getId(), "Prompt", "Claude", "code", " "));

        assertTrue(service.listVersions(task.getId()).isEmpty());
    }

    @Test
    void listVersionsReturnsOldestFirst() {
        Task task = storedStartedTask();
        Artifact first = service.recordArtifact(task.getId(), "Prompt 1", "Claude", "code v1", "ASantana0924");
        Artifact second = service.recordArtifact(task.getId(), "Prompt 2", "Copilot", "code v2", "dquin144");

        assertEquals(List.of(first, second), service.listVersions(task.getId()));
    }

    @Test
    void getVersionReturnsTheMatchingVersion() {
        Task task = storedStartedTask();
        service.recordArtifact(task.getId(), "Prompt 1", "Claude", "code v1", "ASantana0924");
        Artifact second = service.recordArtifact(task.getId(), "Prompt 2", "Copilot", "code v2", "dquin144");

        assertEquals(second, service.getVersion(task.getId(), 2));
    }

    @Test
    void missingVersionIsRejected() {
        Task task = storedStartedTask();
        service.recordArtifact(task.getId(), "Prompt 1", "Claude", "code v1", "ASantana0924");

        assertThrows(NoSuchElementException.class, () -> service.getVersion(task.getId(), 2));
        assertThrows(NoSuchElementException.class, () -> service.getVersion(task.getId(), 0));
    }

    @Test
    void unknownTaskIdIsRejectedForEveryMethod() {
        UUID unknown = UUID.randomUUID();
        assertThrows(NoSuchElementException.class,
                () -> service.recordArtifact(unknown, "Prompt", "Claude", "code", "ASantana0924"));
        assertThrows(NoSuchElementException.class, () -> service.listVersions(unknown));
        assertThrows(NoSuchElementException.class, () -> service.getVersion(unknown, 1));
    }

    @Test
    void recordedArtifactIsSavedBackSoAJpaRepositoryWouldKeepIt() {
        TaskRepository mocked = mock(TaskRepository.class);
        Task task = startedTask();
        when(mocked.findById(task.getId())).thenReturn(Optional.of(task));

        new ArtifactService(mocked).recordArtifact(task.getId(), "Prompt", "Claude", "code", "ASantana0924");

        verify(mocked).save(task);
    }

    @Test
    void failedRecordIsNotSaved() {
        TaskRepository mocked = mock(TaskRepository.class);
        Task draft = new Task("Add login check", "", "ASantana0924");
        when(mocked.findById(draft.getId())).thenReturn(Optional.of(draft));

        assertThrows(IllegalStateException.class,
                () -> new ArtifactService(mocked).recordArtifact(draft.getId(), "Prompt", "Claude", "code", "ASantana0924"));

        verify(mocked, never()).save(any());
    }
}