package verifai.data;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import verifai.domain.Task;

/**
 * Keeps tasks in memory, in the order they were first saved.
 *
 * Used until the JPA repository exists. Stored tasks are lost when the app stops.
 * Methods are synchronized because Spring shares one instance across requests.
 */
public final class InMemoryTaskRepository implements TaskRepository {

    private final Map<UUID, Task> tasks = new LinkedHashMap<>();

    @Override
    public synchronized Task save(Task task) {
        if (task == null) {
            throw new IllegalArgumentException("Task is required");
        }
        tasks.put(task.getId(), task);
        return task;
    }

    @Override
    public synchronized Optional<Task> findById(UUID id) {
        if (id == null) {
            throw new IllegalArgumentException("Id is required");
        }
        return Optional.ofNullable(tasks.get(id));
    }

    @Override
    public synchronized List<Task> findAll() {
        return List.copyOf(tasks.values());
    }
}