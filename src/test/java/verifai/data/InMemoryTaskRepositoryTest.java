package verifai.data;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import verifai.domain.Task;
import verifai.domain.TaskStatus;

class InMemoryTaskRepositoryTest {

    private final InMemoryTaskRepository repository = new InMemoryTaskRepository();

    private Task newTask(String title) {
        return new Task(title, "", "ASantana0924");
    }

    @Test
    void saveReturnsTheSameTask() {
        Task task = newTask("Add login check");
        assertSame(task, repository.save(task));
    }

    @Test
    void findByIdReturnsTheSavedTask() {
        Task task = repository.save(newTask("Add login check"));
        assertSame(task, repository.findById(task.getId()).orElseThrow());
    }

    @Test
    void findByIdIsEmptyForAnUnknownId() {
        repository.save(newTask("Add login check"));
        assertTrue(repository.findById(UUID.randomUUID()).isEmpty());
    }

    @Test
    void findAllIsEmptyWhenNothingIsSaved() {
        assertTrue(repository.findAll().isEmpty());
    }

    @Test
    void findAllReturnsTasksInTheOrderTheyWereFirstSaved() {
        Task first = repository.save(newTask("First"));
        Task second = repository.save(newTask("Second"));
        repository.save(first);
        assertEquals(List.of(first, second), repository.findAll());
    }

    @Test
    void savingTheSameTaskAgainKeepsOneEntry() {
        Task task = repository.save(newTask("Add login check"));
        repository.save(task);
        assertEquals(1, repository.findAll().size());
    }

    @Test
    void savingAChangedTaskKeepsTheChange() {
        Task task = repository.save(newTask("Add login check"));
        task.addRequirement("Reject blank usernames", "ASantana0924");
        task.addAcceptanceCriterion("Blank username shows an error", "ASantana0924");
        task.start("ASantana0924");
        repository.save(task);
        assertEquals(TaskStatus.IN_PROGRESS,
                repository.findById(task.getId()).orElseThrow().getStatus());
    }

    @Test
    void findAllListCannotBeChanged() {
        repository.save(newTask("Add login check"));
        List<Task> all = repository.findAll();
        assertThrows(UnsupportedOperationException.class, () -> all.add(newTask("Other")));
    }

    @Test
    void saveRejectsNull() {
        assertThrows(IllegalArgumentException.class, () -> repository.save(null));
    }

    @Test
    void findByIdRejectsNull() {
        assertThrows(IllegalArgumentException.class, () -> repository.findById(null));
    }
}