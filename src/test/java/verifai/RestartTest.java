package verifai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import verifai.data.TaskRepository;
import verifai.domain.Task;
import verifai.domain.TaskStatus;
import verifai.domain.VerificationType;
import verifai.service.ApprovalService;
import verifai.service.ArtifactService;
import verifai.service.TaskService;
import verifai.service.VerificationService;

/**
 * Stops the app and starts it again on the same database, as a restart with
 * PostgreSQL would. The H2 database is kept between the two runs with
 * DB_CLOSE_DELAY=-1, and Flyway finds the schema already in place.
 */
class RestartTest {

    private static String newDatabaseUrl() {
        return "jdbc:h2:mem:restart-" + UUID.randomUUID()
                + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1";
    }

    private static ConfigurableApplicationContext start(String url, String... profiles) {
        return new SpringApplicationBuilder(App.class)
                .web(WebApplicationType.NONE)
                .profiles(profiles)
                .run("--spring.datasource.url=" + url);
    }

    @Test
    void everyPartOfATaskSurvivesARestart() {
        String url = newDatabaseUrl();
        UUID id;
        Task beforeRestart;
        try (ConfigurableApplicationContext app = start(url)) {
            TaskService tasks = app.getBean(TaskService.class);
            ArtifactService artifacts = app.getBean(ArtifactService.class);
            VerificationService checks = app.getBean(VerificationService.class);
            ApprovalService approvals = app.getBean(ApprovalService.class);

            id = tasks.createTask("Hash stored passwords", "Use bcrypt", "alex").getId();
            tasks.addRequirement(id, "New passwords are bcrypt hashes", "alex");
            tasks.addAcceptanceCriterion(id, "No stored password starts with anything but $2", "alex");
            tasks.startTask(id, "alex");
            artifacts.recordArtifact(id, "Switch to bcrypt", "GitHub Copilot", "encoder = new BCrypt();", "alex");
            checks.recordTestRun(id, "JUnit", 6, 5, 0, "One skipped", "alex");
            for (VerificationType type : VerificationType.values()) {
                checks.markPassed(id, type, "Reviewed", "dana");
            }
            approvals.approve(id, "alex");
            approvals.approve(id, "dana");
            approvals.reopen(id, "dana", "Missed the migration");
            checks.markFailed(id, VerificationType.SECURITY, "Old hashes still accepted", "dana");
            beforeRestart = tasks.getTask(id);
        }

        try (ConfigurableApplicationContext app = start(url)) {
            Task afterRestart = app.getBean(TaskRepository.class).findById(id).orElseThrow();
            assertThat(afterRestart).usingRecursiveComparison().withStrictTypeChecking().isEqualTo(beforeRestart);
            assertEquals(TaskStatus.IN_PROGRESS, afterRestart.getStatus());
            assertEquals(1, afterRestart.getArtifacts().size());
            assertEquals(1, afterRestart.getTestRuns().size());
        }
    }

    @Test
    void demoDataIsAddedOnlyOnceAcrossRestarts() {
        String url = newDatabaseUrl();
        List<UUID> firstRun;
        try (ConfigurableApplicationContext app = start(url, "demo")) {
            firstRun = app.getBean(TaskService.class).listTasks().stream().map(Task::getId).toList();
        }
        try (ConfigurableApplicationContext app = start(url, "demo")) {
            List<UUID> secondRun = app.getBean(TaskService.class).listTasks().stream().map(Task::getId).toList();
            assertEquals(4, firstRun.size());
            assertEquals(firstRun, secondRun);
        }
    }
}
