package verifai.data;

import java.time.Instant;

import org.hibernate.annotations.Immutable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** One stored test run. Inserted once and never changed (ADR-006, ADR-007). */
@Entity
@Immutable
@Table(name = "test_runs")
class TestRunEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false, updatable = false)
    private TaskEntity task;

    /** 0-based place in the task's list of runs, oldest first. */
    @Column(nullable = false, updatable = false)
    private int position;

    @Column(nullable = false, updatable = false)
    private String tool;

    @Column(nullable = false, updatable = false)
    private int total;

    @Column(nullable = false, updatable = false)
    private int passed;

    @Column(nullable = false, updatable = false)
    private int failed;

    @Column(nullable = false, updatable = false)
    private String summary;

    @Column(name = "recorded_by", nullable = false, updatable = false)
    private String recordedBy;

    @Column(name = "recorded_at", nullable = false, updatable = false)
    private Instant recordedAt;

    @Column(name = "artifact_version", updatable = false)
    private Integer artifactVersion;

    protected TestRunEntity() {
        // For JPA.
    }

    TestRunEntity(TaskEntity task, int position, String tool, int total, int passed, int failed,
            String summary, String recordedBy, Instant recordedAt, Integer artifactVersion) {
        this.task = task;
        this.position = position;
        this.tool = tool;
        this.total = total;
        this.passed = passed;
        this.failed = failed;
        this.summary = summary;
        this.recordedBy = recordedBy;
        this.recordedAt = recordedAt;
        this.artifactVersion = artifactVersion;
    }

    String getTool() { return tool; }
    int getTotal() { return total; }
    int getPassed() { return passed; }
    int getFailed() { return failed; }
    String getSummary() { return summary; }
    String getRecordedBy() { return recordedBy; }
    Instant getRecordedAt() { return recordedAt; }
    Integer getArtifactVersion() { return artifactVersion; }
}
