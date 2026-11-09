package verifai.presentation;

import java.util.List;

import verifai.domain.Verification;
import verifai.domain.VerificationStatus;

/** How many of a task's checks are in each status (UC-13). */
public record CheckSummaryResponse(int passed, int failed, int pending, int total) {

    static CheckSummaryResponse from(List<Verification> checks) {
        return new CheckSummaryResponse(
                count(checks, VerificationStatus.PASSED),
                count(checks, VerificationStatus.FAILED),
                count(checks, VerificationStatus.PENDING),
                checks.size());
    }

    private static int count(List<Verification> checks, VerificationStatus status) {
        return (int) checks.stream().filter(check -> check.getStatus() == status).count();
    }
}
