package verifai.domain;

import java.time.Instant;

public final class Artifact {

    private final String prompt;
    private final String aiTool;
    private final String codeContent;
    private final String recordedBy;
    private final int version;
    private final Instant createdAt;

    private Artifact(String prompt, String aiTool, String codeContent, String recordedBy, int version) {
        this.prompt = requireText(prompt, "Prompt is required");
        this.aiTool = requireText(aiTool, "AI tool is required");
        this.codeContent = requireText(codeContent, "Code content is required");
        this.recordedBy = requireText(recordedBy, "Developer is required").strip();
        this.version = version;
        this.createdAt = Instant.now();
    }

    public static Artifact first(String prompt, String aiTool, String codeContent, String recordedBy) {
        return new Artifact(prompt, aiTool, codeContent, recordedBy, 1);
    }

    public Artifact revise(String prompt, String aiTool, String codeContent, String recordedBy) {
        return new Artifact(prompt, aiTool, codeContent, recordedBy, version + 1);
    }

    public String getPrompt() { return prompt; }
    public String getAiTool() { return aiTool; }
    public String getCodeContent() { return codeContent; }
    public String getRecordedBy() { return recordedBy; }
    public int getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }
}
