package verifai.domain;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public final class Task {

    public static final int DEFAULT_REQUIRED_APPROVALS = 2;

    private final String title;
    private final String description;
    private final String owner;
    private TaskStatus status = TaskStatus.DRAFT;
    private final List<String> requirements = new ArrayList<>();
    private final List<String> acceptanceCriteria = new ArrayList<>();
    private final Map<VerificationType, Verification> checks = new EnumMap<>(VerificationType.class);
    private final List<Artifact> artifacts = new ArrayList<>();
    private final List<Approval> approvals = new ArrayList<>();
    private final int requiredApprovals;

    public Task(String title, String description, String owner) {
        this(title, description, owner, DEFAULT_REQUIRED_APPROVALS);
    }

    public Task(String title, String description, String owner, int requiredApprovals) {
        if (requiredApprovals < 1) {
            throw new IllegalArgumentException("At least one approval must be required");
        }
        this.requiredApprovals = requiredApprovals;
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

    public Artifact recordArtifact(String prompt, String aiTool, String codeContent) {
        if (status != TaskStatus.IN_PROGRESS) {
            throw new IllegalStateException("Artifacts can only be recorded on an IN_PROGRESS task");
        }
        Artifact artifact = artifacts.isEmpty()
                ? Artifact.first(prompt, aiTool, codeContent)
                : artifacts.get(artifacts.size() - 1).revise(prompt, aiTool, codeContent);
        artifacts.add(artifact);
        resetChecks();
        return artifact;
    }

    public boolean canApprove() {
        return status == TaskStatus.IN_PROGRESS
                && checks.values().stream().allMatch(c -> c.getStatus() == VerificationStatus.PASSED);
    }

    public Approval approve(String developer) {
        Approval approval = new Approval(developer);
        if (status != TaskStatus.IN_PROGRESS) {
            throw new IllegalStateException("Only an IN_PROGRESS task can be approved");
        }
        if (!canApprove()) {
            throw new IllegalStateException("All six checks must be PASSED before approval");
        }
        boolean alreadyApproved = approvals.stream()
                .anyMatch(a -> a.getDeveloper().equalsIgnoreCase(approval.getDeveloper()));
        if (alreadyApproved) {
            throw new IllegalStateException(approval.getDeveloper() + " has already approved this task");
        }
        approvals.add(approval);
        if (approvals.size() >= requiredApprovals) {
            status = TaskStatus.APPROVED;
        }
        return approval;
    }

    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getOwner() { return owner; }
    public TaskStatus getStatus() { return status; }
    public List<String> getRequirements() { return List.copyOf(requirements); }
    public List<String> getAcceptanceCriteria() { return List.copyOf(acceptanceCriteria); }
    public List<Artifact> getArtifacts() { return List.copyOf(artifacts); }
    public List<Approval> getApprovals() { return List.copyOf(approvals); }
    public int getRequiredApprovals() { return requiredApprovals; }

    public List<Verification> getVerifications() {
        return List.copyOf(checks.values());
    }

    public Verification getVerification(VerificationType type) {
        if (type == null) {
            throw new IllegalArgumentException("Type is required");
        }
        return checks.get(type);
    }

    private void resetChecks() {
        for (Verification check : checks.values()) {
            check.reset();
        }
        approvals.clear();
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value.strip();
    }
}