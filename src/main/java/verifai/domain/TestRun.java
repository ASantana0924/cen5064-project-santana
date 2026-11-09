package verifai.domain;

import java.time.Instant;

/**
 * The results of one automated test run on a task (UC-10).
 *
 * A test run is evidence for the TESTING check and never changes its status; a
 * reviewer still marks the check PASSED or FAILED (ADR-006). Only Task creates
 * test runs, so the constructor is package-private. Tests that neither passed
 * nor failed, such as skipped ones, make up the rest of the total.
 */
public final class TestRun {

    private final String tool;
    private final int total;
    private final int passed;
    private final int failed;
    private final String summary;
    private final String recordedBy;
    private final Instant recordedAt;
    private final Integer artifactVersion;

    /*
     * Counts are Integer so that a count left out of a request is reported as
     * missing (400) instead of being read as 0.
     */
    TestRun(String tool, Integer total, Integer passed, Integer failed, String summary,
            String recordedBy, Integer artifactVersion) {
        this.tool = requireText(tool, "Tool is required");
        this.total = requireCount(total, "Total");
        this.passed = requireCount(passed, "Passed");
        this.failed = requireCount(failed, "Failed");
        if (this.total == 0) {
            throw new IllegalArgumentException("A test run must include at least one test");
        }
        if ((long) this.passed + this.failed > this.total) {
            throw new IllegalArgumentException("Passed plus failed cannot be more than the total");
        }
        this.summary = summary == null ? "" : summary.strip();
        this.recordedBy = requireText(recordedBy, "Developer is required");
        this.artifactVersion = artifactVersion;
        this.recordedAt = Instant.now();
    }

    public String getTool() { return tool; }
    public int getTotal() { return total; }
    public int getPassed() { return passed; }
    public int getFailed() { return failed; }
    public String getSummary() { return summary; }
    public String getRecordedBy() { return recordedBy; }
    public Instant getRecordedAt() { return recordedAt; }

    /** Tests that neither passed nor failed, such as skipped ones. */
    public int getSkipped() { return total - passed - failed; }

    /** The artifact version the tests ran against, or null if the task had no artifact yet. */
    public Integer getArtifactVersion() { return artifactVersion; }

    private static int requireCount(Integer value, String name) {
        if (value == null) {
            throw new IllegalArgumentException(name + " is required");
        }
        if (value < 0) {
            throw new IllegalArgumentException(name + " cannot be negative");
        }
        return value;
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value.strip();
    }
}
