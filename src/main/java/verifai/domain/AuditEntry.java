package verifai.domain;

import java.time.Instant;

public final class AuditEntry {

    private final AuditEventType eventType;
    private final String developer;
    private final String details;
    private final Instant recordedAt;

    public AuditEntry(AuditEventType eventType, String developer, String details) {
        if (eventType == null) {
            throw new IllegalArgumentException("Event type is required");
        }
        if (developer == null || developer.isBlank()) {
            throw new IllegalArgumentException("Developer is required");
        }
        this.eventType = eventType;
        this.developer = developer.strip();
        this.details = details == null ? "" : details.strip();
        this.recordedAt = Instant.now();
    }

    public AuditEventType getEventType() { return eventType; }
    public String getDeveloper() { return developer; }
    public String getDetails() { return details; }
    public Instant getRecordedAt() { return recordedAt; }
}
