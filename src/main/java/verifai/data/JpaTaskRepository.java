package verifai.data;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import verifai.domain.Task;

/**
 * Stores whole tasks in the database with JPA (ADR-003, ADR-007).
 *
 * Each call runs in its own transaction. Loading returns a fresh Task rebuilt
 * from the stored rows, and saving writes the task and all its parts as one
 * unit. Audit entries, artifacts, and test runs are only ever inserted.
 *
 * Two rules keep concurrent requests from losing each other's changes (ADR-010):
 * - Saving locks the task's row first, so two saves of one task run one after
 *   the other. The second then reads the first one's rows, and TaskMapper
 *   refuses it as stale instead of both inserting the same audit position.
 * - Loading reads the task row and each list with separate SELECTs, so it runs
 *   at REPEATABLE READ: every SELECT sees the database as it was at the first
 *   one, even if a save commits in between. Loading takes no lock and never
 *   waits for a save.
 */
@Repository
@Transactional
public class JpaTaskRepository implements TaskRepository {

    private final TaskJpaRepository tasks;

    JpaTaskRepository(TaskJpaRepository tasks) {
        this.tasks = tasks;
    }

    @Override
    public Task save(Task task) {
        if (task == null) {
            throw new IllegalArgumentException("Task is required");
        }
        // Waits here while another save of this task is in progress. The parts are
        // loaded lazily after the lock is taken, so they include that save's rows.
        Optional<TaskEntity> stored = tasks.findForUpdateById(task.getId());
        if (stored.isPresent()) {
            // Loaded in this transaction, so Hibernate writes the changes on commit.
            // Calling save would merge, and merge does not cascade to the new rows.
            TaskMapper.copyToEntity(task, stored.get());
        } else {
            TaskEntity entity = TaskMapper.newEntity(task);
            TaskMapper.copyToEntity(task, entity);
            tasks.save(entity);
        }
        return task;
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Optional<Task> findById(UUID id) {
        if (id == null) {
            throw new IllegalArgumentException("Id is required");
        }
        return tasks.findById(id).map(TaskMapper::toDomain);
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public List<Task> findAll() {
        return tasks.findAllByOrderByCreatedAtAscIdAsc().stream()
                .map(TaskMapper::toDomain)
                .toList();
    }
}
