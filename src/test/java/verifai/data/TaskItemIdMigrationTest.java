package verifai.data;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/**
 * V2 gives requirements and acceptance criteria stored before item ids existed
 * an id each (ADR-009). Runs V1, stores rows the way the app did then, and
 * runs V2 on them, on H2 in PostgreSQL mode like the other tests.
 */
class TaskItemIdMigrationTest {

    private DriverManagerDataSource dataSource;
    private JdbcTemplate jdbc;

    @BeforeEach
    void databaseAtVersion1() {
        dataSource = new DriverManagerDataSource("jdbc:h2:mem:migration-" + UUID.randomUUID()
                + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        migrateTo("1");
    }

    private void migrateTo(String version) {
        Flyway.configure().dataSource(dataSource).target(version).load().migrate();
    }

    private UUID storeVersion1Task() {
        UUID taskId = UUID.randomUUID();
        jdbc.update("INSERT INTO tasks (id, title, description, owner, status, required_approvals, created_at) "
                + "VALUES (?, 'Rate limit', '', 'sam', 'DRAFT', 2, CURRENT_TIMESTAMP)", taskId);
        for (int position = 0; position < 3; position++) {
            jdbc.update("INSERT INTO task_requirements (task_id, position, text) VALUES (?, ?, ?)",
                    taskId, position, "Requirement " + position);
        }
        jdbc.update("INSERT INTO task_acceptance_criteria (task_id, position, text) VALUES (?, 0, 'Criterion')",
                taskId);
        return taskId;
    }

    @Test
    void existingItemsGetDistinctIdsAndKeepTheirTextAndOrder() {
        UUID taskId = storeVersion1Task();

        migrateTo("2");

        List<Map<String, Object>> requirements = jdbc.queryForList(
                "SELECT id, text FROM task_requirements WHERE task_id = ? ORDER BY position", taskId);
        List<Map<String, Object>> criteria = jdbc.queryForList(
                "SELECT id, text FROM task_acceptance_criteria WHERE task_id = ?", taskId);
        assertEquals(List.of("Requirement 0", "Requirement 1", "Requirement 2"),
                requirements.stream().map(row -> row.get("text")).toList());
        assertEquals("Criterion", criteria.get(0).get("text"));
        long distinctIds = Stream.concat(requirements.stream(), criteria.stream())
                .map(row -> (UUID) row.get("id"))
                .distinct()
                .count();
        assertEquals(4, distinctIds);
    }

    @Test
    void afterTheMigrationEveryItemNeedsAnId() {
        UUID taskId = storeVersion1Task();
        migrateTo("2");

        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "INSERT INTO task_requirements (task_id, position, text) VALUES (?, 3, 'No id')", taskId));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "INSERT INTO task_acceptance_criteria (task_id, position, text) VALUES (?, 1, 'No id')", taskId));
    }
}
