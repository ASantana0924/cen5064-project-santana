package verifai.presentation;

import java.time.LocalDate;

import verifai.domain.Verification;

public record CheckResponse(
        String type,
        String status,
        String evidence,
        String notes,
        String reviewer,
        LocalDate reviewedOn) {

    static CheckResponse from(Verification check) {
        return new CheckResponse(
                check.getType().name(),
                check.getStatus().name(),
                check.getEvidence(),
                check.getNotes(),
                check.getReviewer(),
                check.getReviewedOn());
    }
}
