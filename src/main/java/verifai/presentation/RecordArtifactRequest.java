package verifai.presentation;

/** Body of POST /api/tasks/{id}/artifacts. The developer is recorded as the artifact's author. */
public record RecordArtifactRequest(String prompt, String aiTool, String codeContent, String developer) {
}
