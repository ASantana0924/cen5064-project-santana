package verifai.data;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

import verifai.domain.AuditEventType;
import verifai.domain.RuleViolationException;
import verifai.domain.Task;
import verifai.domain.TaskItem;
import verifai.domain.TaskStatus;
import verifai.domain.VerificationStatus;
import verifai.domain.VerificationType;

/**
 * Saves and reloads tasks through JpaTaskRepository on H2, running the same
 * Flyway migration as the app. After each save the persistence context is
 * flushed and cleared, so every load reads the rows back from the database.
 */
@DataJpaTest(properties = "spring.jpa.properties.hibernate.session_factory.statement_inspector="
        + "verifai.data.RecordingStatementInspector")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(JpaTaskRepository.class)
class JpaTaskRepositoryTest {

    @Autowired
    private JpaTaskRepository repository;

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void forgetEarlierStatements() {
        RecordingStatementInspector.clear();
    }

    private Task newTask(String title) {
        return new Task(title, "Lock an account after 5 failed logins.", "sam");
    }

    /**
     * A new task created strictly later than the earlier one. On Windows the clock
     * can advance only every 1 to 16 ms, so tasks made back to back could share a
     * creation time, and tasks with the same time are listed by id instead.
     */
    private Task newTaskCreatedAfter(Task earlier, String title) {
        Task task = newTask(title);
        while (!createdAt(task).isAfter(createdAt(earlier))) {
            task = newTask(title);
        }
        return task;
    }

    private static Instant createdAt(Task task) {
        return task.getAuditHistory().get(0).getRecordedAt();
    }

    /** Saves, writes everything to the database, and empties the persistence context. */
    private void saveAndFlush(Task task) {
        repository.save(task);
        entityManager.flush();
        entityManager.clear();
    }

    private Task reload(Task task) {
        return repository.findById(task.getId()).orElseThrow();
    }

    /** Loads the stored task, changes it, and saves it, as every service method does. */
    private Task change(UUID id, Consumer<Task> step) {
        Task task = repository.findById(id).orElseThrow();
        step.accept(task);
        saveAndFlush(task);
        return task;
    }

    private static void assertSameTask(Task expected, Task actual) {
        assertThat(actual).usingRecursiveComparison().withStrictTypeChecking().isEqualTo(expected);
    }

    /** Takes a new task through every step to APPROVED, saving and reloading after each one. */
    private Task approvedTask() {
        Task task = newTask("Rate limit login attempts");
        saveAndFlush(task);
        UUID id = task.getId();
        change(id, t -> t.addRequirement("Count failed logins per account", "sam"));
        change(id, t -> t.addAcceptanceCriterion("The sixth failed login is refused", "sam"));
        change(id, t -> t.start("sam"));
        change(id, t -> t.recordTestRun("JUnit", 3, 2, 0, "Before any artifact", "sam"));
        change(id, t -> t.recordArtifact("Write a rate limiter", "Claude",
                "class LoginRateLimiter {\n    int attempts;\n}\n", "sam"));
        change(id, t -> t.recordTestRun("JUnit", 8, 8, 0, "All pass", "sam"));
        for (VerificationType type : VerificationType.values()) {
            change(id, t -> t.markCheckPassed(type, "Reviewed " + type, "dana"));
        }
        change(id, t -> t.approve("sam"));
        return change(id, t -> t.approve("dana"));
    }

    @Test
    void newDraftTaskIsEqualAfterReload() {
        Task task = newTask("Add password reset email");
        saveAndFlush(task);
        assertSameTask(task, reload(task));
    }

    @Test
    void approvedTaskIsEqualInEveryFieldAfterReload() {
        Task task = approvedTask();
        Task reloaded = reload(task);
        assertSameTask(task, reloaded);
        assertEquals(TaskStatus.APPROVED, reloaded.getStatus());
        assertEquals(2, reloaded.getApprovals().size());
        assertEquals(2, reloaded.getTestRuns().size());
        assertNull(reloaded.getTestRuns().get(0).getArtifactVersion());
        assertEquals(1, reloaded.getTestRuns().get(1).getArtifactVersion());
    }

    @Test
    void reopenedTaskKeepsItsWholeHistoryAfterReload() {
        Task task = approvedTask();
        Task reopened = change(task.getId(), t -> t.reopen("dana", "Missed a case"));
        Task reloaded = reload(reopened);
        assertSameTask(reopened, reloaded);
        assertEquals(TaskStatus.IN_PROGRESS, reloaded.getStatus());
        assertTrue(reloaded.getApprovals().isEmpty());
        assertTrue(reloaded.getAuditHistory().stream().anyMatch(e -> e.getEventType() == AuditEventType.TASK_REOPENED
                && e.getDetails().equals("Reason: Missed a case. Previous approvals: sam, dana")));
    }

    @Test
    void checksInEveryStateAreEqualAfterReload() {
        Task task = approvedTask();
        Task reopened = change(task.getId(), t -> t.reopen("dana", "Recheck security"));
        change(reopened.getId(), t -> t.markCheckPassed(VerificationType.TESTING, "Tests pass", "dana"));
        Task changed = change(reopened.getId(),
                t -> t.markCheckFailed(VerificationType.SECURITY, "SQL injection in search", "dana"));
        Task reloaded = reload(changed);
        assertSameTask(changed, reloaded);
        assertEquals(VerificationStatus.PASSED, reloaded.getVerification(VerificationType.TESTING).getStatus());
        assertEquals(VerificationStatus.FAILED, reloaded.getVerification(VerificationType.SECURITY).getStatus());
        assertEquals(VerificationStatus.PENDING, reloaded.getVerification(VerificationType.CODE_QUALITY).getStatus());
    }

    @Test
    void editedRequirementsKeepTheirOrderAfterReload() {
        Task task = newTask("Order");
        task.addRequirement("First", "sam");
        task.addRequirement("Second", "sam");
        task.addRequirement("Third", "sam");
        saveAndFlush(task);
        Task changed = change(task.getId(), t -> {
            t.removeRequirement(t.getRequirements().get(0).id(), "sam");
            t.addRequirement("Fourth", "sam");
            t.editDetails("Order of requirements", "New description", "sam");
        });
        Task reloaded = reload(changed);
        assertSameTask(changed, reloaded);
        assertEquals(List.of("Second", "Third", "Fourth"),
                reloaded.getRequirements().stream().map(TaskItem::text).toList());
        assertEquals(changed.getRequirements(), reloaded.getRequirements());
    }

    @Test
    void artifactCodeIsStoredExactlyEvenWhenLong() {
        String code = "\t  line with leading whitespace\n".repeat(5_000) + "  trailing  \n";
        Task task = newTask("Long code");
        task.addRequirement("R", "sam");
        task.addAcceptanceCriterion("AC", "sam");
        task.start("sam");
        task.recordArtifact("Big prompt", "Claude", code, "sam");
        saveAndFlush(task);
        assertEquals(code, reload(task).getArtifacts().get(0).getCodeContent());
    }

    @Test
    void loadingDoesNotAddAuditEntriesOrRunRules() {
        Task task = approvedTask();
        int entries = task.getAuditHistory().size();
        reload(task);
        Task reloaded = reload(task);
        assertEquals(entries, reloaded.getAuditHistory().size());
        Integer stored = jdbc.queryForObject("SELECT COUNT(*) FROM audit_entries WHERE task_id = ?",
                Integer.class, task.getId());
        assertEquals(entries, stored);
    }

    @Test
    void reloadedTaskStillFollowsTheRules() {
        Task reloaded = reload(approvedTask());
        assertThrows(RuleViolationException.class, () -> reloaded.addRequirement("Too late", "sam"));
        assertThrows(RuleViolationException.class, () -> reloaded.approve("alex"));
    }

    @Test
    void auditArtifactAndTestRunRowsAreOnlyEverInserted() {
        Task task = approvedTask();
        List<Map<String, Object>> before = jdbc.queryForList(
                "SELECT * FROM audit_entries WHERE task_id = ? ORDER BY position", task.getId());
        RecordingStatementInspector.clear();

        // Reopen, review, record, fail, and edit: every kind of change, including resets.
        UUID id = task.getId();
        change(id, t -> t.reopen("dana", "Recheck"));
        change(id, t -> t.markCheckPassed(VerificationType.TESTING, "Tests pass", "dana"));
        change(id, t -> t.recordArtifact("Revise", "Claude", "class V2 {}", "sam"));
        change(id, t -> t.recordTestRun("JUnit", 2, 1, 1, "", "sam"));
        change(id, t -> t.markCheckFailed(VerificationType.SECURITY, "Weak", "dana"));
        change(id, t -> t.addRequirement("Another", "sam"));

        List<String> forbidden = RecordingStatementInspector.statements().stream()
                .filter(sql -> sql.startsWith("update") || sql.startsWith("delete"))
                .filter(sql -> sql.contains("audit_entries") || sql.contains("artifacts") || sql.contains("test_runs"))
                .toList();
        assertEquals(List.of(), forbidden);
        assertTrue(RecordingStatementInspector.statements().stream()
                .anyMatch(sql -> sql.startsWith("insert into audit_entries")));

        List<Map<String, Object>> after = jdbc.queryForList(
                "SELECT * FROM audit_entries WHERE task_id = ? ORDER BY position", task.getId());
        assertEquals(before, after.subList(0, before.size()));
    }

    @Test
    void savingAStaleCopyIsRefusedAndWritesNothing() {
        Task task = newTask("Two tabs");
        task.addRequirement("R", "sam");
        task.addAcceptanceCriterion("AC", "sam");
        saveAndFlush(task);
        Task firstTab = reload(task);
        Task secondTab = reload(task);
        firstTab.start("sam");
        saveAndFlush(firstTab);

        secondTab.addRequirement("Added in a stale tab", "dana");
        OptimisticLockingFailureException ex = assertThrows(OptimisticLockingFailureException.class,
                () -> repository.save(secondTab));
        assertEquals("This task was changed by another request. Reload it and try again.", ex.getMessage());
        entityManager.clear();
        assertSameTask(firstTab, reload(task));
    }

    @Test
    void findByIdIsEmptyForAnUnknownId() {
        saveAndFlush(newTask("Known"));
        assertTrue(repository.findById(UUID.randomUUID()).isEmpty());
    }

    @Test
    void findAllReturnsEveryTaskInTheOrderTheyWereCreated() {
        Task first = newTask("First");
        Task second = newTaskCreatedAfter(first, "Second");
        Task third = newTaskCreatedAfter(second, "Third");
        saveAndFlush(second);
        saveAndFlush(first);
        saveAndFlush(third);
        change(first.getId(), t -> t.addRequirement("Saved again later", "sam"));

        List<Task> all = repository.findAll();
        assertEquals(List.of("First", "Second", "Third"), all.stream().map(Task::getTitle).toList());
        assertSameTask(reload(first), all.get(0));
    }

    @Test
    void findAllIsEmptyWhenNothingIsSaved() {
        assertTrue(repository.findAll().isEmpty());
    }

    @Test
    void savingAgainWithoutChangesWritesNothing() {
        Task task = approvedTask();
        RecordingStatementInspector.clear();
        saveAndFlush(reload(task));
        List<String> writes = RecordingStatementInspector.statements().stream()
                .filter(sql -> !sql.startsWith("select"))
                .toList();
        assertEquals(List.of(), writes);
    }

    @Test
    void nullArgumentsAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> repository.save(null));
        assertThrows(IllegalArgumentException.class, () -> repository.findById(null));
    }
}
