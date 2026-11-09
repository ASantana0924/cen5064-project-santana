package verifai.presentation;

import java.time.Instant;

import verifai.domain.Artifact;

/** One artifact version in full, including its prompt and code (UC-07 to UC-09). */
public record ArtifactResponse(
        int version,
        String prompt,
        String aiTool,
        String codeContent,
        String recordedBy,
        Instant createdAt) {

    static ArtifactResponse from(Artifact artifact) {
        return new ArtifactResponse(
                artifact.getVersion(),
                artifact.getPrompt(),
                artifact.getAiTool(),
                artifact.getCodeContent(),
                artifact.getRecordedBy(),
                artifact.getCreatedAt());
    }
}
