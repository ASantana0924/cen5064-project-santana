package verifai.presentation;

import java.time.Instant;

import verifai.domain.Approval;

public record ApprovalResponse(String developer, Instant approvedAt) {

    static ApprovalResponse from(Approval approval) {
        return new ApprovalResponse(approval.getDeveloper(), approval.getApprovedAt());
    }
}
