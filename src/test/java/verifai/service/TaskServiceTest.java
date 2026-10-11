package verifai.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
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
import verifai.domain.Task;
import verifai.domain.TaskStatus;

class TaskServiceTest {

    private final TaskService service = new TaskService(new InMemoryTaskRepository());

    private Task readyTask() {
        Task task = service.createTask("Add login check", "Validate usernames", "ASantana0924");
        service.addRequirement(task.getId(), "Blank usernames are rejected", "ASantana0924");
        service.addAcceptanceCriterion(task.getId(), "Submitting a blank username shows an error", "ASantana0924");
        return task;
    }

    @Test
    void createdTaskIsDraftAndStored() {
        Task task = service.createTask("Add login check", "Validate usernames", "ASantana0924");
        assertEquals(TaskStatus.DRAFT, task.getStatus());
        assertEquals("ASantana0924", task.getOwner());
        assertSame(task, service.getTask(task.getId()));
    }

    @Test
    void createWithBlankTitleIsRejectedAndNothingIsStored() {
        assertThrows(IllegalArgumentException.class, () -> service.createTask(" ", "", "ASantana0924"));
        assertTrue(service.listTasks().isEmpty());
    }

    @Test
    void requirementsAndCriteriaAreAddedToTheStoredTask() {
        Task task = readyTask();
        Task stored = service.getTask(task.getId());
        assertEquals(List.of("Blank usernames are rejected"), stored.getRequirements());
        assertEquals(List.of("Submitting a blank username shows an error"), stored.getAcceptanceCriteria());
    }

    @Test
    void startMovesReadyTaskToInProgress() {
        Task task = readyTask();
        service.startTask(task.getId(), "dquin144");
        assertEquals(TaskStatus.IN_PROGRESS, service.getTask(task.getId()).getStatus());
    }

    @Test
    void startWithoutRequirementsIsRejectedAndTaskStaysDraft() {
        Task task = service.createTask("Add login check", "", "ASantana0924");
        assertThrows(IllegalStateException.class, () -> service.startTask(task.getId(), "ASantana0924"));
        assertEquals(TaskStatus.DRAFT, service.getTask(task.getId()).getStatus());
    }

    @Test
    void listReturnsTasksInCreationOrder() {
        Task first = service.createTask("First", "", "ASantana0924");
        Task second = service.createTask("Second", "", "dquin144");
        assertEquals(List.of(first, second), service.listTasks());
    }

    @Test
    void unknownIdIsRejectedForEveryLookup() {
        UUID unknown = UUID.randomUUID();
        assertThrows(NoSuchElementException.class, () -> service.getTask(unknown));
        assertThrows(NoSuchElementException.class, () -> service.addRequirement(unknown, "Req", "ASantana0924"));
        assertThrows(NoSuchElementException.class, () -> service.addAcceptanceCriterion(unknown, "AC", "ASantana0924"));
        assertThrows(NoSuchElementException.class, () -> service.startTask(unknown, "ASantana0924"));
    }

    @Test
    void changesAreSavedBackSoAJpaRepositoryWouldKeepThem() {
        TaskRepository repository = mock(TaskRepository.class);
        Task task = new Task("Add login check", "", "ASantana0924");
        when(repository.findById(task.getId())).thenReturn(Optional.of(task));
        TaskService mockedService = new TaskService(repository);

        mockedService.addRequirement(task.getId(), "Blank usernames are rejected", "ASantana0924");

        verify(repository).save(task);
    }

    @Test
    void failedStartIsNotSaved() {
        TaskRepository repository = mock(TaskRepository.class);
        Task task = new Task("Add login check", "", "ASantana0924");
        when(repository.findById(task.getId())).thenReturn(Optional.of(task));
        TaskService mockedService = new TaskService(repository);

        assertThrows(IllegalStateException.class, () -> mockedService.startTask(task.getId(), "ASantana0924"));

        verify(repository, never()).save(any());
    }
}