package verifai.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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

    private final TaskService service = new TaskService(new InMemoryTaskRepository(), 2);

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
        assertThrows(NoSuchElementException.class, () -> service.editDetails(unknown, "T", "", "ASantana0924"));
        assertThrows(NoSuchElementException.class, () -> service.removeRequirement(unknown, 0, "ASantana0924"));
        assertThrows(NoSuchElementException.class,
                () -> service.removeAcceptanceCriterion(unknown, 0, "ASantana0924"));
    }

    @Test
    void changesAreSavedBackSoAJpaRepositoryWouldKeepThem() {
        TaskRepository repository = mock(TaskRepository.class);
        Task task = new Task("Add login check", "", "ASantana0924");
        when(repository.findById(task.getId())).thenReturn(Optional.of(task));
        TaskService mockedService = new TaskService(repository, 2);

        mockedService.addRequirement(task.getId(), "Blank usernames are rejected", "ASantana0924");

        verify(repository).save(task);
    }

    @Test
    void failedStartIsNotSaved() {
        TaskRepository repository = mock(TaskRepository.class);
        Task task = new Task("Add login check", "", "ASantana0924");
        when(repository.findById(task.getId())).thenReturn(Optional.of(task));
        TaskService mockedService = new TaskService(repository, 2);

        assertThrows(IllegalStateException.class, () -> mockedService.startTask(task.getId(), "ASantana0924"));

        verify(repository, never()).save(any());
    }

    @Test
    void createdTaskUsesTheConfiguredApprovalCount() {
        TaskService threeApprovals = new TaskService(new InMemoryTaskRepository(), 3);
        Task task = threeApprovals.createTask("Add login check", "", "ASantana0924");
        assertEquals(3, task.getRequiredApprovals());
    }

    @Test
    void editDetailsChangesTheStoredTask() {
        Task task = service.createTask("Add login check", "Validate usernames", "ASantana0924");
        service.editDetails(task.getId(), "Add login validation", "Trim and validate", "dquin144");
        Task stored = service.getTask(task.getId());
        assertEquals("Add login validation", stored.getTitle());
        assertEquals("Trim and validate", stored.getDescription());
    }

    @Test
    void removeRequirementAndCriterionChangeTheStoredTask() {
        Task task = readyTask();
        service.removeRequirement(task.getId(), 0, "ASantana0924");
        service.removeAcceptanceCriterion(task.getId(), 0, "ASantana0924");
        Task stored = service.getTask(task.getId());
        assertTrue(stored.getRequirements().isEmpty());
        assertTrue(stored.getAcceptanceCriteria().isEmpty());
    }

    @Test
    void editsAndRemovalsAreSavedBack() {
        TaskRepository repository = mock(TaskRepository.class);
        Task task = new Task("Add login check", "", "ASantana0924");
        task.addRequirement("Blank usernames are rejected", "ASantana0924");
        task.addAcceptanceCriterion("Submitting a blank username shows an error", "ASantana0924");
        when(repository.findById(task.getId())).thenReturn(Optional.of(task));
        TaskService mockedService = new TaskService(repository, 2);

        mockedService.editDetails(task.getId(), "Renamed", "", "ASantana0924");
        mockedService.removeRequirement(task.getId(), 0, "ASantana0924");
        mockedService.removeAcceptanceCriterion(task.getId(), 0, "ASantana0924");

        verify(repository, times(3)).save(task);
    }

    @Test
    void rejectedRemovalIsNotSaved() {
        TaskRepository repository = mock(TaskRepository.class);
        Task task = new Task("Add login check", "", "ASantana0924");
        when(repository.findById(task.getId())).thenReturn(Optional.of(task));
        TaskService mockedService = new TaskService(repository, 2);

        assertThrows(IllegalArgumentException.class,
                () -> mockedService.removeRequirement(task.getId(), 0, "ASantana0924"));

        verify(repository, never()).save(any());
    }
}
