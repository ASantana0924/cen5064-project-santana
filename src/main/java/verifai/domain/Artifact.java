package verifai.domain;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

public final class Artifact {

    private final String prompt;
    private final String aiTool;
    private final String codeContent;
    private final String recordedBy;
    private final int version;
    private final Instant createdAt;

    private Artifact(String prompt, String aiTool, String codeContent, String recordedBy, int version,
            Instant createdAt) {
        if (version < 1) {
            throw new IllegalArgumentException("Version must be at least 1");
        }
        if (createdAt == null) {
            throw new IllegalArgumentException("Created time is required");
        }
        this.prompt = requireText(prompt, "Prompt is required");
        this.aiTool = requireText(aiTool, "AI tool is required");
        this.codeContent = requireText(codeContent, "Code content is required");
        this.recordedBy = requireText(recordedBy, "Developer is required").strip();
        this.version = version;
        this.createdAt = createdAt;
    }

    public static Artifact first(String prompt, String aiTool, String codeContent, String recordedBy) {
        return new Artifact(prompt, aiTool, codeContent, recordedBy, 1, now());
    }

    public Artifact revise(String prompt, String aiTool, String codeContent, String recordedBy) {
        return new Artifact(prompt, aiTool, codeContent, recordedBy, version + 1, now());
    }

    /** Rebuilds a stored artifact with its original version and time. For the Data tier only. */
    public static Artifact restore(String prompt, String aiTool, String codeContent, String recordedBy,
            int version, Instant createdAt) {
        return new Artifact(prompt, aiTool, codeContent, recordedBy, version, createdAt);
    }

    public String getPrompt() { return prompt; }
    public String getAiTool() { return aiTool; }
    public String getCodeContent() { return codeContent; }
    public String getRecordedBy() { return recordedBy; }
    public int getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }

    /** Cut to microseconds, the precision PostgreSQL stores, so a reloaded artifact is equal to the original. */
    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }
}
