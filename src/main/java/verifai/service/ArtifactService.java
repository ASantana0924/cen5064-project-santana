package verifai.service;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import org.springframework.stereotype.Service;

import verifai.data.TaskRepository;
import verifai.domain.Artifact;
import verifai.domain.Task;

/**
 * Records AI artifacts on a task and shows their version history (UC-07 to UC-09).
 *
 * Artifacts belong to their task, so this class loads the task, calls Task, and
 * saves the task. Task assigns the version number and resets the checks.
 */
@Service
public class ArtifactService {

    private final TaskRepository tasks;

    public ArtifactService(TaskRepository tasks) {
        this.tasks = tasks;
    }

    /**
     * UC-07 and UC-08: records the next artifact version on an IN_PROGRESS task.
     * The first artifact is version 1. Each later one is a revision that gets the
     * next number and sets all six checks back to PENDING.
     */
    public Artifact recordArtifact(UUID taskId, String prompt, String aiTool, String codeContent, String developer) {
        Task task = findTask(taskId);
        Artifact artifact = task.recordArtifact(prompt, aiTool, codeContent, developer);
        tasks.save(task);
        return artifact;
    }

    /** UC-09: returns every artifact version of the task, oldest first. */
    public List<Artifact> listVersions(UUID taskId) {
        return findTask(taskId).getArtifacts();
    }

    /** UC-09: returns one version, or throws NoSuchElementException if the task has no such version. */
    public Artifact getVersion(UUID taskId, int version) {
        return listVersions(taskId).stream()
                .filter(a -> a.getVersion() == version)
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException(
                        "Task " + taskId + " has no artifact version " + version));
    }

    private Task findTask(UUID taskId) {
        return tasks.findById(taskId)
                .orElseThrow(() -> new NoSuchElementException("No task with id " + taskId));
    }
}