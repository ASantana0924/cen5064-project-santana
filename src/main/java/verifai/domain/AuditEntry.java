package verifai.domain;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

public final class AuditEntry {

    private final AuditEventType eventType;
    private final String developer;
    private final String details;
    private final Instant recordedAt;

    public AuditEntry(AuditEventType eventType, String developer, String details) {
        this(eventType, developer, details, Instant.now().truncatedTo(ChronoUnit.MICROS));
    }

    private AuditEntry(AuditEventType eventType, String developer, String details, Instant recordedAt) {
        if (eventType == null) {
            throw new IllegalArgumentException("Event type is required");
        }
        if (developer == null || developer.isBlank()) {
            throw new IllegalArgumentException("Developer is required");
        }
        if (recordedAt == null) {
            throw new IllegalArgumentException("Recorded time is required");
        }
        this.eventType = eventType;
        this.developer = developer.strip();
        this.details = details == null ? "" : details.strip();
        this.recordedAt = recordedAt;
    }

    /** Rebuilds a stored audit entry with its original time. For the Data tier only. */
    public static AuditEntry restore(AuditEventType eventType, String developer, String details,
            Instant recordedAt) {
        return new AuditEntry(eventType, developer, details, recordedAt);
    }

    public AuditEventType getEventType() { return eventType; }
    public String getDeveloper() { return developer; }
    public String getDetails() { return details; }
    public Instant getRecordedAt() { return recordedAt; }
}
