package verifai.service;

import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.NoSuchElementException;
import java.util.UUID;

import org.springframework.stereotype.Service;

import verifai.data.TaskRepository;
import verifai.domain.Task;

/**
 * Gathers a task's verification record for a report (UC-18). It only reads:
 * the task is loaded, copied into a VerificationReport, and never saved. How
 * the report looks is up to the Presentation tier.
 */
@Service
public class ReportService {

    private final TaskRepository tasks;
    private final Clock clock;

    public ReportService(TaskRepository tasks, Clock clock) {
        this.tasks = tasks;
        this.clock = clock;
    }

    /**
     * UC-18: the task's details, requirements, acceptance criteria, checks, test
     * runs, artifact versions, approvals, and audit history, stamped with the
     * current time to the second.
     *
     * @throws NoSuchElementException if no task has this id
     */
    public VerificationReport getReport(UUID taskId) {
        Task task = tasks.findById(taskId)
                .orElseThrow(() -> new NoSuchElementException("No task with id " + taskId));
        return VerificationReport.of(task, clock.instant().truncatedTo(ChronoUnit.SECONDS));
    }
}
