package verifai.domain;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public final class Task {

    private final String title;
    private final String description;
    private final String owner;
    private TaskStatus status = TaskStatus.DRAFT;
    private final List<String> requirements = new ArrayList<>();
    private final List<String> acceptanceCriteria = new ArrayList<>();
    private final Map<VerificationType, Verification> checks = new EnumMap<>(VerificationType.class);

    public Task(String title, String description, String owner) {
        this.title = requireText(title, "Title is required");
        this.owner = requireText(owner, "Owner is required");
        this.description = description == null ? "" : description.strip();
        for (VerificationType type : VerificationType.values()) {
            checks.put(type, new Verification(type));
        }
    }

    public void addRequirement(String requirement) {
        requirements.add(requireText(requirement, "Requirement text is required"));
    }

    public void addAcceptanceCriterion(String criterion) {
        acceptanceCriteria.add(requireText(criterion, "Acceptance criterion text is required"));
    }

    public void start() {
        if (status != TaskStatus.DRAFT) {
            throw new IllegalStateException("Only a DRAFT task can be started");
        }
        if (requirements.isEmpty()) {
            throw new IllegalStateException("At least one requirement is needed to start a task");
        }
        if (acceptanceCriteria.isEmpty()) {
            throw new IllegalStateException("At least one acceptance criterion is needed to start a task");
        }
        status = TaskStatus.IN_PROGRESS;
    }

    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getOwner() { return owner; }
    public TaskStatus getStatus() { return status; }
    public List<String> getRequirements() { return List.copyOf(requirements); }
    public List<String> getAcceptanceCriteria() { return List.copyOf(acceptanceCriteria); }

    public List<Verification> getVerifications() {
        return List.copyOf(checks.values());
    }

    public Verification getVerification(VerificationType type) {
        if (type == null) {
            throw new IllegalArgumentException("Type is required");
        }
        return checks.get(type);
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value.strip();
    }
}