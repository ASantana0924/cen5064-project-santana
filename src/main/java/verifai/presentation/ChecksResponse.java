package verifai.presentation;

import java.util.List;

import verifai.domain.Verification;

/** Body of GET /api/tasks/{id}/checks: the six checks in order, plus counts by status (UC-13). */
public record ChecksResponse(List<CheckResponse> checks, CheckSummaryResponse summary) {

    static ChecksResponse from(List<Verification> checks) {
        return new ChecksResponse(
                checks.stream().map(CheckResponse::from).toList(),
                CheckSummaryResponse.from(checks));
    }
}
