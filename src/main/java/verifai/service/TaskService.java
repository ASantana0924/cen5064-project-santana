package verifai.service;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import verifai.data.TaskRepository;
import verifai.domain.Task;

/**
 * Creates, edits, starts, lists, and finds tasks (UC-01 to UC-06).
 *
 * Business rules stay in Task. This class loads the task, calls Task, and saves
 * the result. It saves after every change so a later JPA repository, which hands
 * back a fresh copy on each load, keeps working the same way.
 */
@Service
public class TaskService {

    private final TaskRepository tasks;
    private final int requiredApprovals;

    public TaskService(TaskRepository tasks,
            @Value("${verifai.approvals.required:2}") int requiredApprovals) {
        this.tasks = tasks;
        this.requiredApprovals = requiredApprovals;
    }

    /** UC-01: creates a DRAFT task owned by the given developer, using the app-wide approval count. */
    public Task createTask(String title, String description, String owner) {
        return tasks.save(new Task(title, description, owner, requiredApprovals));
    }

    /** UC-03: changes the title and description. */
    public Task editDetails(UUID taskId, String title, String description, String developer) {
        Task task = getTask(taskId);
        task.editDetails(title, description, developer);
        return tasks.save(task);
    }

    /** UC-03: adds a requirement to the task. */
    public Task addRequirement(UUID taskId, String requirement, String developer) {
        Task task = getTask(taskId);
        task.addRequirement(requirement, developer);
        return tasks.save(task);
    }

    /** UC-02: adds an acceptance criterion to the task. */
    public Task addAcceptanceCriterion(UUID taskId, String criterion, String developer) {
        Task task = getTask(taskId);
        task.addAcceptanceCriterion(criterion, developer);
        return tasks.save(task);
    }

    /** UC-03: removes the requirement at the 0-based index. */
    public Task removeRequirement(UUID taskId, int index, String developer) {
        Task task = getTask(taskId);
        task.removeRequirement(index, developer);
        return tasks.save(task);
    }

    /** UC-02: removes the acceptance criterion at the 0-based index. */
    public Task removeAcceptanceCriterion(UUID taskId, int index, String developer) {
        Task task = getTask(taskId);
        task.removeAcceptanceCriterion(index, developer);
        return tasks.save(task);
    }

    /** UC-04: moves a DRAFT task to IN_PROGRESS. */
    public Task startTask(UUID taskId, String developer) {
        Task task = getTask(taskId);
        task.start(developer);
        return tasks.save(task);
    }

    /** UC-05: returns every task, oldest first. */
    public List<Task> listTasks() {
        return tasks.findAll();
    }

    /** UC-06: returns the task, or throws NoSuchElementException if there is none. */
    public Task getTask(UUID taskId) {
        return tasks.findById(taskId)
                .orElseThrow(() -> new NoSuchElementException("No task with id " + taskId));
    }
}