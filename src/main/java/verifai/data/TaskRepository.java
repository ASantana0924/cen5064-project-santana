package verifai.data;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import verifai.domain.Task;

/**
 * Stores and finds tasks.
 *
 * Task is the only way to change its checks, artifacts, approvals, and audit
 * history, so those are saved and loaded together with their task. There is no
 * separate repository for them.
 */
public interface TaskRepository {

    /** Adds the task, or replaces the stored task with the same id. Returns the saved task. */
    Task save(Task task);

    /** Returns the task with this id, or empty if none is stored. */
    Optional<Task> findById(UUID id);

    /** Returns every stored task. */
    List<Task> findAll();
}