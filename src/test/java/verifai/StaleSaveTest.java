package verifai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;

import verifai.data.TaskRepository;
import verifai.domain.Task;

/**
 * Checks a stale save through the repository bean the running app uses. In the
 * full app, Spring's persistence exception translation wraps what a
 * {@code @Repository} throws, which {@code @DataJpaTest} does not show. The
 * refusal must still arrive as OptimisticLockingFailureException, the
 * exception ApiExceptionHandler turns into a 409 (ADR-008).
 */
@SpringBootTest
class StaleSaveTest {

    @Autowired
    private TaskRepository repository;

    @Test
    void aStaleSaveReachesThePresentationTierAsOptimisticLockingFailure() {
        Task task = new Task("Add login check", "", "sam");
        task.addRequirement("Blank usernames are rejected", "sam");
        task.addAcceptanceCriterion("A blank username shows an error", "sam");
        repository.save(task);
        Task firstTab = repository.findById(task.getId()).orElseThrow();
        Task secondTab = repository.findById(task.getId()).orElseThrow();
        firstTab.start("sam");
        repository.save(firstTab);

        secondTab.addRequirement("Added in a stale tab", "dana");
        OptimisticLockingFailureException ex = assertThrows(OptimisticLockingFailureException.class,
                () -> repository.save(secondTab));
        assertEquals("This task was changed by another request. Reload it and try again.", ex.getMessage());
    }
}
