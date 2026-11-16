package verifai.domain;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

public final class Approval {

    private final String developer;
    private final Instant approvedAt;

    public Approval(String developer) {
        this(developer, Instant.now().truncatedTo(ChronoUnit.MICROS));
    }

    private Approval(String developer, Instant approvedAt) {
        if (developer == null || developer.isBlank()) {
            throw new IllegalArgumentException("Developer is required");
        }
        if (approvedAt == null) {
            throw new IllegalArgumentException("Approval time is required");
        }
        this.developer = developer.strip();
        this.approvedAt = approvedAt;
    }

    /** Rebuilds a stored approval with its original time. For the Data tier only. */
    public static Approval restore(String developer, Instant approvedAt) {
        return new Approval(developer, approvedAt);
    }

    public String getDeveloper() { return developer; }
    public Instant getApprovedAt() { return approvedAt; }
}
