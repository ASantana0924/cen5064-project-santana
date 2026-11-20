package verifai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import verifai.data.TaskRepository;
import verifai.domain.Approval;
import verifai.domain.AuditEventType;
import verifai.domain.Task;
import verifai.domain.TaskStatus;
import verifai.domain.VerificationType;

/**
 * Requests that change the same task at the same moment (#79, ADR-010). The
 * stale-save check in TaskMapper only works if a save compares against every
 * change committed before it, and against a copy of the task that was loaded
 * as it was at one moment. So JpaTaskRepository locks the task row while it
 * saves, and loads each task at REPEATABLE READ. These tests run the full app
 * against H2.
 *
 * H2 gives up on a lock after a second or two by default, while PostgreSQL
 * waits as long as needed. The longer H2 timeout keeps a slow test machine
 * from turning a wait into a lock timeout. StatementHook puts another
 * request's commit at an exact point inside a load.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.hikari.connection-init-sql=SET LOCK_TIMEOUT 10000",
        "spring.jpa.properties.hibernate.session_factory.statement_inspector=verifai.StatementHook" })
class ConcurrentSaveTest {

    private static final String STALE_MESSAGE = "This task was changed by another request. Reload it and try again.";

    @Autowired
    private TaskRepository repository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @PersistenceContext
    private EntityManager entityManager;

    @LocalServerPort
    private int port;

    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    private final HttpClient http = HttpClient.newHttpClient();

    @AfterEach
    void stopThreads() {
        StatementHook.clear();
        executor.shutdownNow();
    }

    /** A stored IN_PROGRESS task with an artifact and all six checks PASSED. */
    private Task taskReadyToApprove(String title) {
        Task task = new Task(title, "", "sam");
        task.addRequirement("Count failed logins per account", "sam");
        task.addAcceptanceCriterion("The sixth failed login is refused", "sam");
        task.start("sam");
        task.recordArtifact("Write a rate limiter", "Claude", "class LoginRateLimiter {}", "sam");
        for (VerificationType type : VerificationType.values()) {
            task.markCheckPassed(type, "Reviewed " + type, "dana");
        }
        return repository.save(task);
    }

    private Task load(UUID id) {
        return repository.findById(id).orElseThrow();
    }

    private static List<String> approvers(Task task) {
        return task.getApprovals().stream().map(Approval::getDeveloper).toList();
    }

    private static long count(Task task, AuditEventType type) {
        return task.getAuditHistory().stream().filter(e -> e.getEventType() == type).count();
    }

    @Test
    void aSaveWaitsForAnotherSaveOfTheSameTaskAndIsThenRefusedAsStale() throws Exception {
        UUID id = taskReadyToApprove("Rate limit login attempts").getId();
        Task alexTab = load(id);
        Task danaTab = load(id);
        alexTab.approve("alex");
        danaTab.approve("dana");

        AtomicReference<Future<Task>> danaSave = new AtomicReference<>();
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            // Alex's rows are written but not committed, so his save is still in progress.
            repository.save(alexTab);
            entityManager.flush();

            danaSave.set(executor.submit(() -> repository.save(danaTab)));
            assertThrows(TimeoutException.class, () -> danaSave.get().get(300, TimeUnit.MILLISECONDS),
                    "Dana's save should wait while Alex's save holds the task");
        });

        // Alex's save has committed, so Dana's save now reads his approval and is refused.
        ExecutionException ex = assertThrows(ExecutionException.class,
                () -> danaSave.get().get(10, TimeUnit.SECONDS));
        OptimisticLockingFailureException refusal =
                assertInstanceOf(OptimisticLockingFailureException.class, ex.getCause());
        assertEquals(STALE_MESSAGE, refusal.getMessage());

        Task stored = load(id);
        assertEquals(List.of("alex"), approvers(stored));
        assertEquals(1, count(stored, AuditEventType.APPROVAL_RECORDED));
        assertEquals(TaskStatus.IN_PROGRESS, stored.getStatus());
    }

    /**
     * Loading a task takes several SELECTs: the task row, then each list. Here
     * Dana's approval is committed after Alex's load has read the approvals but
     * before it reads the audit history. The load must still return the task as
     * it was at one moment, or Alex's copy would hold Dana's audit entry without
     * her approval, pass the stale-save check, and his save would replace her
     * approval with his own.
     */
    @Test
    void aTaskIsLoadedAsItWasAtOneMomentEvenIfASaveCommitsDuringTheLoad() throws Exception {
        UUID id = taskReadyToApprove("Rate limit login attempts").getId();
        Task danaTab = load(id);
        danaTab.approve("dana");

        StatementHook.before("from audit_entries", () -> {
            try {
                executor.submit(() -> repository.save(danaTab)).get(10, TimeUnit.SECONDS);
            } catch (InterruptedException | ExecutionException | TimeoutException e) {
                throw new AssertionError("Dana's save should commit during Alex's load", e);
            }
        });
        Task alexTab = load(id);
        assertFalse(StatementHook.pending(), "Dana's save should have run during Alex's load");

        // Alex sees the task from before Dana's save: no approval and no audit entry for it.
        assertEquals(List.of(), approvers(alexTab));
        assertEquals(0, count(alexTab, AuditEventType.APPROVAL_RECORDED));

        alexTab.approve("alex");
        OptimisticLockingFailureException refusal = assertThrows(OptimisticLockingFailureException.class,
                () -> repository.save(alexTab));
        assertEquals(STALE_MESSAGE, refusal.getMessage());
        assertEquals(List.of("dana"), approvers(load(id)));
    }

    @Test
    void savingOneTaskDoesNotMakeSavesOfOtherTasksWait() throws Exception {
        Task first = load(taskReadyToApprove("First").getId());
        Task second = load(taskReadyToApprove("Second").getId());
        first.approve("alex");
        second.approve("dana");

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            repository.save(first);
            entityManager.flush();

            Future<Task> otherSave = executor.submit(() -> repository.save(second));
            Task saved = assertDoesNotTimeOut(otherSave);
            assertEquals(List.of("dana"), approvers(saved));
        });

        assertEquals(List.of("alex"), approvers(load(first.getId())));
        assertEquals(List.of("dana"), approvers(load(second.getId())));
    }

    private static Task assertDoesNotTimeOut(Future<Task> save) {
        try {
            return save.get(5, TimeUnit.SECONDS);
        } catch (InterruptedException | ExecutionException | TimeoutException e) {
            throw new AssertionError("The save of another task should finish at once", e);
        }
    }

    /**
     * The reviewer's scenario over HTTP: two developers click Approve at the same
     * moment, many times over. Depending on timing, both approvals are stored one
     * after the other, or the second is refused with 409. Either way no request
     * fails with 500, and the stored task matches the answers the users saw.
     */
    @Test
    void twoApprovalsAtTheSameMomentNeverFailWith500() throws Exception {
        for (int round = 0; round < 25; round++) {
            UUID id = taskReadyToApprove("Round " + round).getId();
            CyclicBarrier bothReady = new CyclicBarrier(2);
            Future<Integer> alex = executor.submit(() -> approve(id, "alex", bothReady));
            Future<Integer> dana = executor.submit(() -> approve(id, "dana", bothReady));
            List<Integer> statuses = List.of(alex.get(10, TimeUnit.SECONDS), dana.get(10, TimeUnit.SECONDS));

            assertTrue(statuses.stream().allMatch(s -> s == 200 || s == 409),
                    "Round " + round + " answered " + statuses);
            long approved = statuses.stream().filter(s -> s == 200).count();
            assertTrue(approved >= 1, "Round " + round + " stored no approval: " + statuses);
            Task stored = load(id);
            assertEquals(approved, stored.getApprovals().size(), "Round " + round);
            assertEquals(approved, count(stored, AuditEventType.APPROVAL_RECORDED), "Round " + round);
            assertEquals(approved == 2 ? TaskStatus.APPROVED : TaskStatus.IN_PROGRESS, stored.getStatus());
        }
    }

    private int approve(UUID id, String developer, CyclicBarrier bothReady) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(
                "http://localhost:" + port + "/api/tasks/" + id + "/approvals"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"developer\":\"" + developer + "\"}"))
                .build();
        bothReady.await(10, TimeUnit.SECONDS);
        return http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
    }
}
