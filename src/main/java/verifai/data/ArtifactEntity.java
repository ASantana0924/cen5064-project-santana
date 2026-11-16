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

/** One stored artifact version. Inserted once and never changed (ADR-007). */
@Entity
@Immutable
@Table(name = "artifacts")
class ArtifactEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false, updatable = false)
    private TaskEntity task;

    @Column(nullable = false, updatable = false)
    private int version;

    @Column(nullable = false, updatable = false)
    private String prompt;

    @Column(name = "ai_tool", nullable = false, updatable = false)
    private String aiTool;

    @Column(name = "code_content", nullable = false, updatable = false)
    private String codeContent;

    @Column(name = "recorded_by", nullable = false, updatable = false)
    private String recordedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ArtifactEntity() {
        // For JPA.
    }

    ArtifactEntity(TaskEntity task, int version, String prompt, String aiTool, String codeContent,
            String recordedBy, Instant createdAt) {
        this.task = task;
        this.version = version;
        this.prompt = prompt;
        this.aiTool = aiTool;
        this.codeContent = codeContent;
        this.recordedBy = recordedBy;
        this.createdAt = createdAt;
    }

    int getVersion() { return version; }
    String getPrompt() { return prompt; }
    String getAiTool() { return aiTool; }
    String getCodeContent() { return codeContent; }
    String getRecordedBy() { return recordedBy; }
    Instant getCreatedAt() { return createdAt; }
}
