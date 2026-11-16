package verifai.data;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import verifai.domain.Task;

/**
 * Stores whole tasks in the database with JPA (ADR-003, ADR-007).
 *
 * Each call runs in its own transaction. Loading returns a fresh Task rebuilt
 * from the stored rows, and saving writes the task and all its parts as one
 * unit. Audit entries, artifacts, and test runs are only ever inserted.
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
        Optional<TaskEntity> stored = tasks.findById(task.getId());
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
    @Transactional(readOnly = true)
    public Optional<Task> findById(UUID id) {
        if (id == null) {
            throw new IllegalArgumentException("Id is required");
        }
        return tasks.findById(id).map(TaskMapper::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Task> findAll() {
        return tasks.findAllByOrderByCreatedAtAscIdAsc().stream()
                .map(TaskMapper::toDomain)
                .toList();
    }
}
