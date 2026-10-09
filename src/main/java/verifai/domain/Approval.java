package verifai.domain;

import java.time.Instant;

public final class Approval {

    private final String developer;
    private final Instant approvedAt;

    public Approval(String developer) {
        if (developer == null || developer.isBlank()) {
            throw new IllegalArgumentException("Developer is required");
        }
        this.developer = developer.strip();
        this.approvedAt = Instant.now();
    }

    public String getDeveloper() { return developer; }
    public Instant getApprovedAt() { return approvedAt; }
}
