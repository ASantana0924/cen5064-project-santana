package verifai.presentation;

import java.time.Instant;

import verifai.domain.Artifact;

/** One row of the version history (UC-09). Leaves out the prompt and code; fetch a version for those. */
public record ArtifactSummaryResponse(int version, String aiTool, String recordedBy, Instant createdAt) {

    static ArtifactSummaryResponse from(Artifact artifact) {
        return new ArtifactSummaryResponse(
                artifact.getVersion(),
                artifact.getAiTool(),
                artifact.getRecordedBy(),
                artifact.getCreatedAt());
    }
}
