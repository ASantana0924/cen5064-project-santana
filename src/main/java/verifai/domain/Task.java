package verifai.domain;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

public final class Task {

    public static final int DEFAULT_REQUIRED_APPROVALS = 2;

    private final UUID id = UUID.randomUUID();
    private String title;
    private String description;
    private final String owner;
    private TaskStatus status = TaskStatus.DRAFT;
    private final List<String> requirements = new ArrayList<>();
    private final List<String> acceptanceCriteria = new ArrayList<>();
    private final Map<VerificationType, Verification> checks = new EnumMap<>(VerificationType.class);
    private final List<Artifact> artifacts = new ArrayList<>();
    private final List<Approval> approvals = new ArrayList<>();
    private final List<AuditEntry> auditHistory = new ArrayList<>();
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
        addAuditEntry(AuditEventType.TASK_CREATED, this.owner, "Title: " + this.title);
    }

    public void addRequirement(String requirement, String developer) {
        String text = requireText(requirement, "Requirement text is required");
        String who = requireText(developer, "Developer is required");
        requireEditable();
        requirements.add(text);
        addAuditEntry(AuditEventType.TASK_EDITED, who, "Added requirement: " + text);
        resetChecksIfInProgress(who, "Requirement added");
    }

    public void addAcceptanceCriterion(String criterion, String developer) {
        String text = requireText(criterion, "Acceptance criterion text is required");
        String who = requireText(developer, "Developer is required");
        requireEditable();
        acceptanceCriteria.add(text);
        addAuditEntry(AuditEventType.TASK_EDITED, who, "Added acceptance criterion: " + text);
        resetChecksIfInProgress(who, "Acceptance criterion added");
    }

    /** Changes the title and description. Does nothing if neither changed. Never resets checks. */
    public void editDetails(String newTitle, String newDescription, String developer) {
        String text = requireText(newTitle, "Title is required");
        String details = newDescription == null ? "" : newDescription.strip();
        String who = requireText(developer, "Developer is required");
        requireEditable();
        List<String> changes = new ArrayList<>();
        if (!text.equals(title)) {
            changes.add("Title: \"" + title + "\" -> \"" + text + "\"");
        }
        if (!details.equals(description)) {
            changes.add("Description changed");
        }
        if (changes.isEmpty()) {
            return;
        }
        title = text;
        description = details;
        addAuditEntry(AuditEventType.TASK_EDITED, who, String.join(". ", changes));
    }

    /** Removes the requirement at the 0-based index. */
    public void removeRequirement(int index, String developer) {
        String who = requireText(developer, "Developer is required");
        requireEditable();
        String removed = removeItem(requirements, index, "requirement");
        addAuditEntry(AuditEventType.TASK_EDITED, who, "Removed requirement: " + removed);
        resetChecksIfInProgress(who, "Requirement removed");
    }

    /** Removes the acceptance criterion at the 0-based index. */
    public void removeAcceptanceCriterion(int index, String developer) {
        String who = requireText(developer, "Developer is required");
        requireEditable();
        String removed = removeItem(acceptanceCriteria, index, "acceptance criterion");
        addAuditEntry(AuditEventType.TASK_EDITED, who, "Removed acceptance criterion: " + removed);
        resetChecksIfInProgress(who, "Acceptance criterion removed");
    }

    public void start(String developer) {
        String who = requireText(developer, "Developer is required");
        if (!canStart()) {
            throw new IllegalStateException(reasonCannotStart());
        }
        status = TaskStatus.IN_PROGRESS;
        addAuditEntry(AuditEventType.TASK_STARTED, who, "");
    }

    public Artifact recordArtifact(String prompt, String aiTool, String codeContent, String developer) {
        String who = requireText(developer, "Developer is required");
        if (status != TaskStatus.IN_PROGRESS) {
            throw new IllegalStateException("Artifacts can only be recorded on an IN_PROGRESS task");
        }
        Artifact artifact = artifacts.isEmpty()
                ? Artifact.first(prompt, aiTool, codeContent)
                : artifacts.get(artifacts.size() - 1).revise(prompt, aiTool, codeContent);
        artifacts.add(artifact);
        addAuditEntry(AuditEventType.ARTIFACT_RECORDED, who,
                "Version " + artifact.getVersion() + ", AI tool: " + artifact.getAiTool());
        resetChecks(who, "New artifact version " + artifact.getVersion());
        return artifact;
    }

    public void markCheckPassed(VerificationType type, String evidence, String reviewer) {
        if (status != TaskStatus.IN_PROGRESS) {
            throw new IllegalStateException("Checks can only be passed on an IN_PROGRESS task");
        }
        Verification check = getVerification(type);
        check.markPassed(evidence, reviewer);
        addAuditEntry(AuditEventType.CHECK_PASSED, check.getReviewer(), type + ": " + check.getEvidence());
    }

    /** True while the task's details, requirements, and criteria may change. */
    public boolean isEditable() {
        return status == TaskStatus.DRAFT || status == TaskStatus.IN_PROGRESS;
    }

    /** True when the task is DRAFT with at least one requirement and one acceptance criterion. */
    public boolean canStart() {
        return status == TaskStatus.DRAFT && !requirements.isEmpty() && !acceptanceCriteria.isEmpty();
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
        addAuditEntry(AuditEventType.APPROVAL_RECORDED, approval.getDeveloper(),
                approvals.size() + " of " + requiredApprovals + " approvals");
        if (approvals.size() >= requiredApprovals) {
            status = TaskStatus.APPROVED;
            addAuditEntry(AuditEventType.TASK_APPROVED, approval.getDeveloper(), "Approved by " + approverNames());
        }
        return approval;
    }

    public void markCheckFailed(VerificationType type, String notes, String reviewer) {
        if (status != TaskStatus.IN_PROGRESS) {
            throw new IllegalStateException("Checks can only be failed on an IN_PROGRESS task");
        }
        Verification check = getVerification(type);
        check.markFailed(notes, reviewer);
        String cleared = approvals.isEmpty() ? "none" : approverNames();
        approvals.clear();
        addAuditEntry(AuditEventType.CHECK_FAILED, check.getReviewer(),
                type + ": " + check.getNotes() + ". Approvals cleared: " + cleared);
    }

    public AuditEntry reopen(String developer, String reason) {
        String why = requireText(reason, "A reason is required to reopen a task");
        if (status != TaskStatus.APPROVED) {
            throw new IllegalStateException("Only an APPROVED task can be reopened");
        }
        AuditEntry entry = addAuditEntry(AuditEventType.TASK_REOPENED, developer,
                "Reason: " + why + ". Previous approvals: " + approverNames());
        resetChecks(entry.getDeveloper(), "Task reopened");
        status = TaskStatus.IN_PROGRESS;
        return entry;
    }

    public UUID getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getOwner() { return owner; }
    public TaskStatus getStatus() { return status; }
    public List<String> getRequirements() { return List.copyOf(requirements); }
    public List<String> getAcceptanceCriteria() { return List.copyOf(acceptanceCriteria); }
    public List<Artifact> getArtifacts() { return List.copyOf(artifacts); }
    public List<Approval> getApprovals() { return List.copyOf(approvals); }
    public int getRequiredApprovals() { return requiredApprovals; }
    public List<AuditEntry> getAuditHistory() { return List.copyOf(auditHistory); }

    public List<Verification> getVerifications() {
        return List.copyOf(checks.values());
    }

    public Verification getVerification(VerificationType type) {
        if (type == null) {
            throw new IllegalArgumentException("Type is required");
        }
        return checks.get(type);
    }

    private AuditEntry addAuditEntry(AuditEventType eventType, String developer, String details) {
        AuditEntry entry = new AuditEntry(eventType, developer, details);
        auditHistory.add(entry);
        return entry;
    }

    private String approverNames() {
        return approvals.stream()
                .map(Approval::getDeveloper)
                .collect(Collectors.joining(", "));
    }

    private void requireEditable() {
        if (!isEditable()) {
            throw new IllegalStateException("Only a DRAFT or IN_PROGRESS task can be edited");
        }
    }

    private String reasonCannotStart() {
        if (status != TaskStatus.DRAFT) {
            return "Only a DRAFT task can be started";
        }
        if (requirements.isEmpty()) {
            return "At least one requirement is needed to start a task";
        }
        return "At least one acceptance criterion is needed to start a task";
    }

    /** An IN_PROGRESS task always keeps at least one item, because starting required one. */
    private String removeItem(List<String> items, int index, String label) {
        if (index < 0 || index >= items.size()) {
            throw new IllegalArgumentException("No " + label + " at position " + index);
        }
        if (status == TaskStatus.IN_PROGRESS && items.size() == 1) {
            throw new IllegalStateException("An IN_PROGRESS task needs at least one " + label);
        }
        return items.remove(index);
    }

    private void resetChecksIfInProgress(String developer, String cause) {
        if (status == TaskStatus.IN_PROGRESS) {
            resetChecks(developer, cause);
        }
    }

    private void resetChecks(String developer, String cause) {
        boolean anythingToReset = !approvals.isEmpty()
                || checks.values().stream().anyMatch(c -> c.getStatus() != VerificationStatus.PENDING);
        for (Verification check : checks.values()) {
            check.reset();
        }
        approvals.clear();
        if (anythingToReset) {
            addAuditEntry(AuditEventType.CHECKS_RESET, developer, cause);
        }
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value.strip();
    }
}