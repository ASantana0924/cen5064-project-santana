package verifai.service;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import org.springframework.stereotype.Service;

import verifai.data.TaskRepository;
import verifai.domain.Task;
import verifai.domain.TestRun;
import verifai.domain.Verification;
import verifai.domain.VerificationType;

/**
 * Records automated test runs, marks checks passed or failed, and shows a
 * task's checks (UC-10 to UC-13).
 *
 * Checks and test runs belong to their task, so this class loads the task,
 * calls Task, and saves the task. Task enforces the rules: evidence to pass,
 * notes to fail, IN_PROGRESS only, clearing approvals when a check fails, and
 * never changing a check when a test run is recorded.
 */
@Service
public class VerificationService {

    private final TaskRepository tasks;

    public VerificationService(TaskRepository tasks) {
        this.tasks = tasks;
    }

    /**
     * UC-10: records the results of an automated test run as evidence for the
     * TESTING check. The run stores the current artifact version. It never
     * changes any check's status; a reviewer still marks TESTING passed or failed.
     */
    public TestRun recordTestRun(UUID taskId, String tool, Integer total, Integer passed, Integer failed,
            String summary, String developer) {
        Task task = findTask(taskId);
        TestRun run = task.recordTestRun(tool, total, passed, failed, summary, developer);
        tasks.save(task);
        return run;
    }

    /** UC-10: returns every test run of the task, newest first. */
    public List<TestRun> listTestRuns(UUID taskId) {
        return findTask(taskId).getTestRuns().reversed();
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