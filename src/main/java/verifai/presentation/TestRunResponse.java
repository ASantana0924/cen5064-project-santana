package verifai.presentation;

import java.time.Instant;

import verifai.domain.TestRun;

/**
 * One recorded test run (UC-10). skipped is total minus passed minus failed.
 * artifactVersion is null when the task had no artifact when the run was recorded.
 */
public record TestRunResponse(
        String tool,
        int total,
        int passed,
        int failed,
        int skipped,
        String summary,
        String recordedBy,
        Instant recordedAt,
        Integer artifactVersion) {

    static TestRunResponse from(TestRun run) {
        return new TestRunResponse(
                run.getTool(),
                run.getTotal(),
                run.getPassed(),
                run.getFailed(),
                run.getSkipped(),
                run.getSummary(),
                run.getRecordedBy(),
                run.getRecordedAt(),
                run.getArtifactVersion());
    }
}
