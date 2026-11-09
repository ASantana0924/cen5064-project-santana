package verifai.presentation;

import java.time.Instant;

import verifai.domain.AuditEntry;

/** One entry of a task's audit history (UC-16). */
public record AuditEntryResponse(String eventType, String developer, String details, Instant recordedAt) {

    static AuditEntryResponse from(AuditEntry entry) {
        return new AuditEntryResponse(
                entry.getEventType().name(),
                entry.getDeveloper(),
                entry.getDetails(),
                entry.getRecordedAt());
    }
}
