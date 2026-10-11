package verifai.service;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import org.springframework.stereotype.Service;

import verifai.data.TaskRepository;
import verifai.domain.Approval;
import verifai.domain.AuditEntry;
import verifai.domain.Task;

/**
 * Approves tasks, reopens approved tasks, and shows a task's audit history (UC-14 to UC-16).
 *
 * Task enforces the rules: all six checks PASSED, no duplicate approver, the
 * required approval count, and a reason to reopen. This class loads the task,
 * calls Task, and saves the task.
 */
@Service
public class ApprovalService {

    private final TaskRepository tasks;

    public ApprovalService(TaskRepository tasks) {
        this.tasks = tasks;
    }

    /** UC-14: records the developer's approval. The task becomes APPROVED once the required count is met. */
    public Approval approve(UUID taskId, String developer) {
        Task task = findTask(taskId);
        Approval approval = task.approve(developer);
        tasks.save(task);
        return approval;
    }

    /** UC-15: returns an APPROVED task to IN_PROGRESS, resets all checks, and clears approvals. */
    public AuditEntry reopen(UUID taskId, String developer, String reason) {
        Task task = findTask(taskId);
        AuditEntry entry = task.reopen(developer, reason);
        tasks.save(task);
        return entry;
    }

    /** UC-16: returns the task's audit entries, oldest first. */
    public List<AuditEntry> getAuditHistory(UUID taskId) {
        return findTask(taskId).getAuditHistory();
    }

    private Task findTask(UUID taskId) {
        return tasks.findById(taskId)
                .orElseThrow(() -> new NoSuchElementException("No task with id " + taskId));
    }
}