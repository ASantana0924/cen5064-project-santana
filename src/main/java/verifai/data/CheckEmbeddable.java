package verifai.data;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import verifai.domain.VerificationStatus;

/** One row of the checks table. The check type is the map key in TaskEntity. */
@Embeddable
class CheckEmbeddable {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private VerificationStatus status;

    private String evidence;
    private String notes;
    private String reviewer;

    @Column(name = "reviewed_on")
    private LocalDate reviewedOn;

    protected CheckEmbeddable() {
        // For JPA.
    }

    CheckEmbeddable(VerificationStatus status, String evidence, String notes, String reviewer,
            LocalDate reviewedOn) {
        this.status = status;
        this.evidence = evidence;
        this.notes = notes;
        this.reviewer = reviewer;
        this.reviewedOn = reviewedOn;
    }

    VerificationStatus getStatus() { return status; }
    String getEvidence() { return evidence; }
    String getNotes() { return notes; }
    String getReviewer() { return reviewer; }
    LocalDate getReviewedOn() { return reviewedOn; }
}
