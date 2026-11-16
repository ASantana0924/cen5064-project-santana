package verifai.data;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** One row of the approvals table. Its position is the order column in TaskEntity. */
@Embeddable
class ApprovalEmbeddable {

    @Column(nullable = false)
    private String developer;

    @Column(name = "approved_at", nullable = false)
    private Instant approvedAt;

    protected ApprovalEmbeddable() {
        // For JPA.
    }

    ApprovalEmbeddable(String developer, Instant approvedAt) {
        this.developer = developer;
        this.approvedAt = approvedAt;
    }

    String getDeveloper() { return developer; }
    Instant getApprovedAt() { return approvedAt; }
}
