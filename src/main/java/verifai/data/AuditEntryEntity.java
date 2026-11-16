package verifai.data;

import java.time.Instant;

import org.hibernate.annotations.Immutable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import verifai.domain.AuditEventType;

/**
 * One stored audit entry. Audit rows are only ever inserted (README Rule 9):
 * the entity is immutable, every column is not updatable, and TaskEntity
 * cascades PERSIST only, so nothing updates or deletes them.
 */
@Entity
@Immutable
@Table(name = "audit_entries")
class AuditEntryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false, updatable = false)
    private TaskEntity task;

    /** 0-based place in the task's audit history, oldest first. */
    @Column(nullable = false, updatable = false)
    private int position;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, updatable = false)
    private AuditEventType eventType;

    @Column(nullable = false, updatable = false)
    private String developer;

    @Column(nullable = false, updatable = false)
    private String details;

    @Column(name = "recorded_at", nullable = false, updatable = false)
    private Instant recordedAt;

    protected AuditEntryEntity() {
        // For JPA.
    }

    AuditEntryEntity(TaskEntity task, int position, AuditEventType eventType, String developer,
            String details, Instant recordedAt) {
        this.task = task;
        this.position = position;
        this.eventType = eventType;
        this.developer = developer;
        this.details = details;
        this.recordedAt = recordedAt;
    }

    AuditEventType getEventType() { return eventType; }
    String getDeveloper() { return developer; }
    String getDetails() { return details; }
    Instant getRecordedAt() { return recordedAt; }
}
