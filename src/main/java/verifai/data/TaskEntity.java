package verifai.data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.Persistable;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.MapKeyEnumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import verifai.domain.TaskStatus;
import verifai.domain.VerificationType;

/**
 * The stored form of a Task and everything it owns. Only TaskMapper reads or
 * writes these fields; the Domain never sees this class.
 *
 * Requirements, acceptance criteria, checks, and approvals may change, so they
 * are element collections that Hibernate updates to match. Artifacts, test runs,
 * and audit entries only grow: they cascade PERSIST and nothing else, so new
 * rows are inserted and existing rows are never updated or deleted.
 */
@Entity
@Table(name = "tasks")
class TaskEntity implements Persistable<UUID> {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false, updatable = false)
    private String owner;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status;

    @Column(name = "required_approvals", nullable = false, updatable = false)
    private int requiredApprovals;

    /** When the task was created, used to list tasks in creation order. */
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @ElementCollection
    @CollectionTable(name = "task_requirements", joinColumns = @JoinColumn(name = "task_id"))
    @OrderColumn(name = "position")
    @Column(name = "text", nullable = false)
    private List<String> requirements = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "task_acceptance_criteria", joinColumns = @JoinColumn(name = "task_id"))
    @OrderColumn(name = "position")
    @Column(name = "text", nullable = false)
    private List<String> acceptanceCriteria = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "checks", joinColumns = @JoinColumn(name = "task_id"))
    @MapKeyEnumerated(EnumType.STRING)
    @MapKeyColumn(name = "type")
    private Map<VerificationType, CheckEmbeddable> checks = new EnumMap<>(VerificationType.class);

    @ElementCollection
    @CollectionTable(name = "approvals", joinColumns = @JoinColumn(name = "task_id"))
    @OrderColumn(name = "position")
    private List<ApprovalEmbeddable> approvals = new ArrayList<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.PERSIST)
    @OrderBy("version")
    private List<ArtifactEntity> artifacts = new ArrayList<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.PERSIST)
    @OrderBy("position")
    private List<TestRunEntity> testRuns = new ArrayList<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.PERSIST)
    @OrderBy("position")
    private List<AuditEntryEntity> auditEntries = new ArrayList<>();

    /** True until the entity is first stored or loaded, so Spring Data persists it instead of merging. */
    @Transient
    private boolean isNew = true;

    protected TaskEntity() {
        // For JPA.
    }

    TaskEntity(UUID id, String owner, int requiredApprovals, Instant createdAt) {
        this.id = id;
        this.owner = owner;
        this.requiredApprovals = requiredApprovals;
        this.createdAt = createdAt;
    }

    @Override
    public UUID getId() { return id; }

    @Override
    public boolean isNew() { return isNew; }

    @PostLoad
    @PostPersist
    void markStored() {
        isNew = false;
    }

    String getTitle() { return title; }
    void setTitle(String title) { this.title = title; }
    String getDescription() { return description; }
    void setDescription(String description) { this.description = description; }
    String getOwner() { return owner; }
    TaskStatus getStatus() { return status; }
    void setStatus(TaskStatus status) { this.status = status; }
    int getRequiredApprovals() { return requiredApprovals; }
    Instant getCreatedAt() { return createdAt; }
    List<String> getRequirements() { return requirements; }
    List<String> getAcceptanceCriteria() { return acceptanceCriteria; }
    Map<VerificationType, CheckEmbeddable> getChecks() { return checks; }
    List<ApprovalEmbeddable> getApprovals() { return approvals; }
    List<ArtifactEntity> getArtifacts() { return artifacts; }
    List<TestRunEntity> getTestRuns() { return testRuns; }
    List<AuditEntryEntity> getAuditEntries() { return auditEntries; }
}
