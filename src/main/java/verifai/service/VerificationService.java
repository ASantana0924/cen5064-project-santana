package verifai.service;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import org.springframework.stereotype.Service;

import verifai.data.TaskRepository;
import verifai.domain.Task;
import verifai.domain.Verification;
import verifai.domain.VerificationType;

/**
 * Marks checks passed or failed and shows a task's checks (UC-11 to UC-13).
 *
 * Checks belong to their task, so this class loads the task, calls Task, and
 * saves the task. Task enforces the rules: evidence to pass, notes to fail,
 * IN_PROGRESS only, and clearing approvals when a check fails.
 */
@Service
public class VerificationService {

    private final TaskRepository tasks;

    public VerificationService(TaskRepository tasks) {
        this.tasks = tasks;
    }

    /** UC-11: marks the check PASSED with the given evidence. */
    public Verification markPassed(UUID taskId, VerificationType type, String evidence, String reviewer) {
        Task task = findTask(taskId);
        task.markCheckPassed(type, evidence, reviewer);
        tasks.save(task);
        return task.getVerification(type);
    }

    /** UC-12: marks the check FAILED with the given notes. This also clears all approvals. */
    public Verification markFailed(UUID taskId, VerificationType type, String notes, String reviewer) {
        Task task = findTask(taskId);
        task.markCheckFailed(type, notes, reviewer);
        tasks.save(task);
        return task.getVerification(type);
    }

    /** UC-13: returns all six checks in VerificationType order. */
    public List<Verification> listChecks(UUID taskId) {
        return findTask(taskId).getVerifications();
    }

    /** UC-13: returns one check. */
    public Verification getCheck(UUID taskId, VerificationType type) {
        return findTask(taskId).getVerification(type);
    }

    private Task findTask(UUID taskId) {
        return tasks.findById(taskId)
                .orElseThrow(() -> new NoSuchElementException("No task with id " + taskId));
    }
}