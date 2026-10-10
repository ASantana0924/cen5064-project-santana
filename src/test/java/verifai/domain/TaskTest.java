package verifai.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

class TaskTest {

    private Task newTask() {
        return new Task("Add login check", "Reject blank usernames", "ASantana0924");
    }

    @Test
    void storesTitleDescriptionAndOwner() {
        Task task = newTask();
        assertEquals("Add login check", task.getTitle());
        assertEquals("Reject blank usernames", task.getDescription());
        assertEquals("ASantana0924", task.getOwner());
    }

    @Test
    void newTaskStartsInDraft() {
        assertEquals(TaskStatus.DRAFT, newTask().getStatus());
    }

    @Test
    void newTaskHasOneCheckPerTypeInEnumOrder() {
        List<Verification> checks = newTask().getVerifications();
        VerificationType[] types = VerificationType.values();
        assertEquals(6, checks.size());
        for (int i = 0; i < types.length; i++) {
            assertEquals(types[i], checks.get(i).getType());
        }
    }

    @Test
    void allChecksStartPending() {
        for (Verification check : newTask().getVerifications()) {
            assertEquals(VerificationStatus.PENDING, check.getStatus(), check.getType().name());
        }
    }

    @Test
    void getVerificationReturnsTheCheckForThatType() {
        Task task = newTask();
        for (VerificationType type : VerificationType.values()) {
            assertEquals(type, task.getVerification(type).getType());
        }
        assertThrows(IllegalArgumentException.class, () -> task.getVerification(null));
    }

    @Test
    void getVerificationAndListReturnTheSameCheck() {
        Task task = newTask();
        assertSame(task.getVerification(VerificationType.TESTING),
                task.getVerifications().get(VerificationType.TESTING.ordinal()));
    }

    @Test
    void checkListCannotBeModified() {
        List<Verification> checks = newTask().getVerifications();
        assertThrows(UnsupportedOperationException.class, () -> checks.clear());
        assertThrows(UnsupportedOperationException.class,
                () -> checks.add(new Verification(VerificationType.SECURITY)));
    }

    @Test
    void tasksDoNotShareChecks() {
        assertNotSame(newTask().getVerification(VerificationType.SECURITY),
                newTask().getVerification(VerificationType.SECURITY));
    }

    @Test
    void titleAndOwnerAreTrimmed() {
        Task task = new Task("  Add login check ", null, " dquin144 ");
        assertEquals("Add login check", task.getTitle());
        assertEquals("dquin144", task.getOwner());
    }

    @Test
    void missingDescriptionBecomesEmptyText() {
        assertEquals("", new Task("Add login check", null, "dquin144").getDescription());
    }

    @Test
    void blankTitleOrOwnerIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> new Task(" ", "desc", "dquin144"));
        assertThrows(IllegalArgumentException.class, () -> new Task(null, "desc", "dquin144"));
        assertThrows(IllegalArgumentException.class, () -> new Task("Title", "desc", ""));
        assertThrows(IllegalArgumentException.class, () -> new Task("Title", "desc", null));
    }

    private Task readyTask() {
        Task task = newTask();
        task.addRequirement("Blank usernames are rejected");
        task.addAcceptanceCriterion("Submitting a blank username shows an error");
        return task;
    }

    @Test
    void newTaskHasNoRequirementsOrCriteria() {
        Task task = newTask();
        assertTrue(task.getRequirements().isEmpty());
        assertTrue(task.getAcceptanceCriteria().isEmpty());
    }

    @Test
    void requirementsAndCriteriaAreStoredTrimmedInOrder() {
        Task task = newTask();
        task.addRequirement("  First requirement ");
        task.addRequirement("Second requirement");
        task.addAcceptanceCriterion(" First criterion ");
        assertEquals(List.of("First requirement", "Second requirement"), task.getRequirements());
        assertEquals(List.of("First criterion"), task.getAcceptanceCriteria());
    }

    @Test
    void blankRequirementOrCriterionIsRejected() {
        Task task = newTask();
        assertThrows(IllegalArgumentException.class, () -> task.addRequirement(" "));
        assertThrows(IllegalArgumentException.class, () -> task.addRequirement(null));
        assertThrows(IllegalArgumentException.class, () -> task.addAcceptanceCriterion(""));
        assertThrows(IllegalArgumentException.class, () -> task.addAcceptanceCriterion(null));
        assertTrue(task.getRequirements().isEmpty());
        assertTrue(task.getAcceptanceCriteria().isEmpty());
    }

    @Test
    void requirementAndCriterionListsCannotBeModified() {
        Task task = readyTask();
        assertThrows(UnsupportedOperationException.class, () -> task.getRequirements().clear());
        assertThrows(UnsupportedOperationException.class, () -> task.getAcceptanceCriteria().add("x"));
    }

    @Test
    void startMovesReadyTaskToInProgress() {
        Task task = readyTask();
        task.start();
        assertEquals(TaskStatus.IN_PROGRESS, task.getStatus());
    }

    @Test
    void startWithoutRequirementIsRejected() {
        Task task = newTask();
        task.addAcceptanceCriterion("Submitting a blank username shows an error");
        assertThrows(IllegalStateException.class, task::start);
        assertEquals(TaskStatus.DRAFT, task.getStatus());
    }

    @Test
    void startWithoutAcceptanceCriterionIsRejected() {
        Task task = newTask();
        task.addRequirement("Blank usernames are rejected");
        assertThrows(IllegalStateException.class, task::start);
        assertEquals(TaskStatus.DRAFT, task.getStatus());
    }

    @Test
    void startingTwiceIsRejected() {
        Task task = readyTask();
        task.start();
        assertThrows(IllegalStateException.class, task::start);
        assertEquals(TaskStatus.IN_PROGRESS, task.getStatus());
    }

    @Test
    void inProgressTaskCanStillGetRequirementsAndCriteria() {
        Task task = readyTask();
        task.start();
        task.addRequirement("Usernames are trimmed");
        task.addAcceptanceCriterion("A padded username is saved trimmed");
        assertEquals(2, task.getRequirements().size());
        assertEquals(2, task.getAcceptanceCriteria().size());
    }

    @Test
    void startingKeepsAllChecksPending() {
        Task task = readyTask();
        task.start();
        for (Verification check : task.getVerifications()) {
            assertEquals(VerificationStatus.PENDING, check.getStatus(), check.getType().name());
        }
    }

    private Task startedTask() {
        Task task = readyTask();
        task.start();
        return task;
    }

    private void assertAllChecksPending(Task task) {
        for (Verification check : task.getVerifications()) {
            assertEquals(VerificationStatus.PENDING, check.getStatus(), check.getType().name());
        }
    }

    @Test
    void newTaskHasNoArtifacts() {
        assertTrue(newTask().getArtifacts().isEmpty());
    }

    @Test
    void firstRecordedArtifactIsVersionOne() {
        Task task = startedTask();
        Artifact artifact = task.recordArtifact("Write a login check", "Claude", "boolean ok() { return true; }");
        assertEquals(1, artifact.getVersion());
        assertEquals(List.of(artifact), task.getArtifacts());
    }

    @Test
    void laterArtifactsGetTheNextVersionInOrder() {
        Task task = startedTask();
        task.recordArtifact("Write a login check", "Claude", "v1 code");
        task.recordArtifact("Handle null input", "Claude", "v2 code");
        task.recordArtifact("Trim input", "Copilot", "v3 code");
        List<Artifact> artifacts = task.getArtifacts();
        assertEquals(3, artifacts.size());
        for (int i = 0; i < artifacts.size(); i++) {
            assertEquals(i + 1, artifacts.get(i).getVersion());
        }
        assertEquals("Copilot", artifacts.get(2).getAiTool());
    }

    @Test
    void newArtifactVersionResetsAllChecksToPending() {
        Task task = startedTask();
        task.recordArtifact("Write a login check", "Claude", "v1 code");
        task.getVerification(VerificationType.TESTING).markPassed("All tests pass", "dquin144");
        task.getVerification(VerificationType.SECURITY).markFailed("SQL injection risk", "ASantana0924");
        task.recordArtifact("Fix SQL injection", "Claude", "v2 code");
        assertAllChecksPending(task);
        Verification testing = task.getVerification(VerificationType.TESTING);
        assertNull(testing.getEvidence());
        assertNull(testing.getReviewer());
        assertNull(task.getVerification(VerificationType.SECURITY).getNotes());
    }

    @Test
    void firstArtifactAlsoResetsChecks() {
        Task task = startedTask();
        task.getVerification(VerificationType.REQUIREMENTS).markPassed("Reviewed", "dquin144");
        task.recordArtifact("Write a login check", "Claude", "v1 code");
        assertAllChecksPending(task);
    }

    @Test
    void recordingOnDraftTaskIsRejected() {
        Task task = readyTask();
        assertThrows(IllegalStateException.class,
                () -> task.recordArtifact("Write a login check", "Claude", "v1 code"));
        assertTrue(task.getArtifacts().isEmpty());
    }

    @Test
    void invalidArtifactIsNotStoredAndChecksAreKept() {
        Task task = startedTask();
        task.recordArtifact("Write a login check", "Claude", "v1 code");
        task.getVerification(VerificationType.TESTING).markPassed("All tests pass", "dquin144");
        assertThrows(IllegalArgumentException.class, () -> task.recordArtifact("Fix it", "Claude", " "));
        assertEquals(1, task.getArtifacts().size());
        assertEquals(VerificationStatus.PASSED, task.getVerification(VerificationType.TESTING).getStatus());
    }

    @Test
    void artifactListCannotBeModified() {
        Task task = startedTask();
        task.recordArtifact("Write a login check", "Claude", "v1 code");
        assertThrows(UnsupportedOperationException.class, () -> task.getArtifacts().clear());
    }

    private Task verifiedTask() {
        Task task = startedTask();
        task.recordArtifact("Write a login check", "Claude", "v1 code");
        for (VerificationType type : VerificationType.values()) {
            task.markCheckPassed(type, "Reviewed " + type, "dquin144");
        }
        return task;
    }

    @Test
    void newTaskNeedsTwoApprovalsAndHasNone() {
        Task task = newTask();
        assertEquals(2, task.getRequiredApprovals());
        assertTrue(task.getApprovals().isEmpty());
    }

    @Test
    void approvalCountCanBeSetPerTask() {
        assertEquals(3, new Task("Add login check", null, "dquin144", 3).getRequiredApprovals());
    }

    @Test
    void approvalCountBelowOneIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> new Task("Add login check", null, "dquin144", 0));
    }

    @Test
    void canApproveOnlyWhenAllChecksPassed() {
        Task task = startedTask();
        assertFalse(task.canApprove());
        assertTrue(verifiedTask().canApprove());
    }

    @Test
    void approveIsRejectedWhileAnyCheckIsPending() {
        Task task = startedTask();
        for (VerificationType type : VerificationType.values()) {
            if (type != VerificationType.SECURITY) {
                task.getVerification(type).markPassed("Reviewed", "dquin144");
            }
        }
        assertThrows(IllegalStateException.class, () -> task.approve("dquin144"));
        assertTrue(task.getApprovals().isEmpty());
        assertEquals(TaskStatus.IN_PROGRESS, task.getStatus());
    }

    @Test
    void approveIsRejectedWhenACheckFailed() {
        Task task = verifiedTask();
        task.getVerification(VerificationType.TESTING).markFailed("Two tests fail", "dquin144");
        assertThrows(IllegalStateException.class, () -> task.approve("dquin144"));
        assertTrue(task.getApprovals().isEmpty());
    }

    @Test
    void approveIsRejectedOnDraftTask() {
        Task task = readyTask();
        assertThrows(IllegalStateException.class, () -> task.approve("dquin144"));
        assertEquals(TaskStatus.DRAFT, task.getStatus());
    }

    @Test
    void firstApprovalKeepsTaskInProgress() {
        Task task = verifiedTask();
        Approval approval = task.approve("dquin144");
        assertEquals("dquin144", approval.getDeveloper());
        assertEquals(List.of(approval), task.getApprovals());
        assertEquals(TaskStatus.IN_PROGRESS, task.getStatus());
    }

    @Test
    void secondDeveloperApprovalApprovesTask() {
        Task task = verifiedTask();
        task.approve("dquin144");
        task.approve("ASantana0924");
        assertEquals(2, task.getApprovals().size());
        assertEquals(TaskStatus.APPROVED, task.getStatus());
    }

    @Test
    void duplicateApprovalBySameDeveloperIsRejected() {
        Task task = verifiedTask();
        task.approve("dquin144");
        assertThrows(IllegalStateException.class, () -> task.approve("dquin144"));
        assertThrows(IllegalStateException.class, () -> task.approve("  DQUIN144 "));
        assertEquals(1, task.getApprovals().size());
        assertEquals(TaskStatus.IN_PROGRESS, task.getStatus());
    }

    @Test
    void blankApproverIsRejected() {
        Task task = verifiedTask();
        assertThrows(IllegalArgumentException.class, () -> task.approve(" "));
        assertThrows(IllegalArgumentException.class, () -> task.approve(null));
        assertTrue(task.getApprovals().isEmpty());
    }

    @Test
    void approvedTaskCannotBeApprovedAgain() {
        Task task = verifiedTask();
        task.approve("dquin144");
        task.approve("ASantana0924");
        assertFalse(task.canApprove());
        assertThrows(IllegalStateException.class, () -> task.approve("thirdDev"));
        assertEquals(2, task.getApprovals().size());
    }

    @Test
    void customApprovalCountIsRespected() {
        Task task = new Task("Add login check", null, "ASantana0924", 3);
        task.addRequirement("Blank usernames are rejected");
        task.addAcceptanceCriterion("Submitting a blank username shows an error");
        task.start();
        for (Verification check : task.getVerifications()) {
            check.markPassed("Reviewed", "dquin144");
        }
        task.approve("dquin144");
        task.approve("ASantana0924");
        assertEquals(TaskStatus.IN_PROGRESS, task.getStatus());
        task.approve("thirdDev");
        assertEquals(TaskStatus.APPROVED, task.getStatus());
    }

    @Test
    void newArtifactVersionClearsApprovals() {
        Task task = verifiedTask();
        task.approve("dquin144");
        task.recordArtifact("Handle null input", "Claude", "v2 code");
        assertTrue(task.getApprovals().isEmpty());
        assertFalse(task.canApprove());
    }

    @Test
    void approvalListCannotBeModified() {
        Task task = verifiedTask();
        task.approve("dquin144");
        assertThrows(UnsupportedOperationException.class, () -> task.getApprovals().clear());
    }

    private Task approvedTask() {
        Task task = verifiedTask();
        task.approve("dquin144");
        task.approve("ASantana0924");
        return task;
    }

    @Test
    void failingACheckSetsItFailedAndClearsApprovals() {
        Task task = verifiedTask();
        task.approve("dquin144");
        task.markCheckFailed(VerificationType.SECURITY, "Password is logged", "ASantana0924");
        Verification security = task.getVerification(VerificationType.SECURITY);
        assertEquals(VerificationStatus.FAILED, security.getStatus());
        assertEquals("Password is logged", security.getNotes());
        assertTrue(task.getApprovals().isEmpty());
        assertEquals(TaskStatus.IN_PROGRESS, task.getStatus());
    }

    @Test
    void failingACheckKeepsOtherChecksPassed() {
        Task task = verifiedTask();
        task.markCheckFailed(VerificationType.SECURITY, "Password is logged", "ASantana0924");
        for (Verification check : task.getVerifications()) {
            if (check.getType() != VerificationType.SECURITY) {
                assertEquals(VerificationStatus.PASSED, check.getStatus(), check.getType().name());
            }
        }
    }

    @Test
    void failingACheckWithoutNotesKeepsApprovals() {
        Task task = verifiedTask();
        task.approve("dquin144");
        assertThrows(IllegalArgumentException.class,
                () -> task.markCheckFailed(VerificationType.SECURITY, " ", "ASantana0924"));
        assertEquals(1, task.getApprovals().size());
        assertEquals(VerificationStatus.PASSED, task.getVerification(VerificationType.SECURITY).getStatus());
    }

    @Test
    void failingACheckOnDraftOrApprovedTaskIsRejected() {
        Task draft = readyTask();
        assertThrows(IllegalStateException.class,
                () -> draft.markCheckFailed(VerificationType.TESTING, "Two tests fail", "dquin144"));
        Task approved = approvedTask();
        assertThrows(IllegalStateException.class,
                () -> approved.markCheckFailed(VerificationType.TESTING, "Two tests fail", "dquin144"));
        assertEquals(TaskStatus.APPROVED, approved.getStatus());
        assertEquals(2, approved.getApprovals().size());
    }

    @Test
    void reopenReturnsTaskToInProgressWithChecksPendingAndNoApprovals() {
        Task task = approvedTask();
        task.reopen("ASantana0924", "Found a missed edge case");
        assertEquals(TaskStatus.IN_PROGRESS, task.getStatus());
        assertAllChecksPending(task);
        assertTrue(task.getApprovals().isEmpty());
        assertFalse(task.canApprove());
    }

    @Test
    void reopenRecordsReasonAndOldApprovalsInAuditHistory() {
        Task task = approvedTask();
        AuditEntry entry = task.reopen("ASantana0924", "  Found a missed edge case ");
        assertEquals(entry, lastEntry(task));
        assertEquals(AuditEventType.TASK_REOPENED, entry.getEventType());
        assertEquals("ASantana0924", entry.getDeveloper());
        assertEquals("Reason: Found a missed edge case. Previous approvals: dquin144, ASantana0924",
                entry.getDetails());
    }

    @Test
    void reopenWithoutReasonIsRejected() {
        Task task = approvedTask();
        int entriesBefore = task.getAuditHistory().size();
        assertThrows(IllegalArgumentException.class, () -> task.reopen("ASantana0924", " "));
        assertThrows(IllegalArgumentException.class, () -> task.reopen("ASantana0924", null));
        assertEquals(TaskStatus.APPROVED, task.getStatus());
        assertEquals(2, task.getApprovals().size());
        assertEquals(entriesBefore, task.getAuditHistory().size());
    }

    @Test
    void reopenWithoutDeveloperIsRejected() {
        Task task = approvedTask();
        int entriesBefore = task.getAuditHistory().size();
        assertThrows(IllegalArgumentException.class, () -> task.reopen(" ", "Found a missed edge case"));
        assertEquals(TaskStatus.APPROVED, task.getStatus());
        assertEquals(2, task.getApprovals().size());
        assertEquals(entriesBefore, task.getAuditHistory().size());
    }

    @Test
    void onlyAnApprovedTaskCanBeReopened() {
        assertThrows(IllegalStateException.class, () -> readyTask().reopen("dquin144", "Reason"));
        assertThrows(IllegalStateException.class, () -> verifiedTask().reopen("dquin144", "Reason"));
    }

    @Test
    void reopenedTaskCanBeApprovedAgain() {
        Task task = approvedTask();
        task.reopen("ASantana0924", "Found a missed edge case");
        task.recordArtifact("Handle the edge case", "Claude", "v2 code");
        for (VerificationType type : VerificationType.values()) {
            task.markCheckPassed(type, "Reviewed again", "dquin144");
        }
        task.approve("dquin144");
        task.approve("ASantana0924");
        assertEquals(TaskStatus.APPROVED, task.getStatus());
        assertEquals(2, eventTypes(task).stream().filter(t -> t == AuditEventType.TASK_APPROVED).count());
        assertEquals(1, eventTypes(task).stream().filter(t -> t == AuditEventType.TASK_REOPENED).count());
    }

    @Test
    void auditHistoryCannotBeModified() {
        Task task = approvedTask();
        task.reopen("ASantana0924", "Found a missed edge case");
        assertThrows(UnsupportedOperationException.class, () -> task.getAuditHistory().clear());
        assertThrows(UnsupportedOperationException.class,
                () -> task.getAuditHistory().add(new AuditEntry(AuditEventType.TASK_EDITED, "x", "")));
    }

    private List<AuditEventType> eventTypes(Task task) {
        return task.getAuditHistory().stream().map(AuditEntry::getEventType).toList();
    }

    private AuditEntry lastEntry(Task task) {
        List<AuditEntry> history = task.getAuditHistory();
        return history.get(history.size() - 1);
    }

    @Test
    void creatingATaskRecordsTaskCreatedByOwner() {
        AuditEntry entry = newTask().getAuditHistory().get(0);
        assertEquals(AuditEventType.TASK_CREATED, entry.getEventType());
        assertEquals("ASantana0924", entry.getDeveloper());
        assertEquals("Title: Add login check", entry.getDetails());
        assertEquals(1, newTask().getAuditHistory().size());
    }

    @Test
    void passingACheckRecordsCheckPassed() {
        Task task = startedTask();
        task.markCheckPassed(VerificationType.TESTING, "All tests pass", "dquin144");
        assertEquals(VerificationStatus.PASSED, task.getVerification(VerificationType.TESTING).getStatus());
        AuditEntry entry = lastEntry(task);
        assertEquals(AuditEventType.CHECK_PASSED, entry.getEventType());
        assertEquals("dquin144", entry.getDeveloper());
        assertEquals("TESTING: All tests pass", entry.getDetails());
    }

    @Test
    void passingACheckOnDraftOrApprovedTaskIsRejected() {
        Task draft = readyTask();
        assertThrows(IllegalStateException.class,
                () -> draft.markCheckPassed(VerificationType.TESTING, "All tests pass", "dquin144"));
        assertEquals(VerificationStatus.PENDING, draft.getVerification(VerificationType.TESTING).getStatus());
        Task approved = approvedTask();
        int entriesBefore = approved.getAuditHistory().size();
        assertThrows(IllegalStateException.class,
                () -> approved.markCheckPassed(VerificationType.TESTING, "All tests pass", "dquin144"));
        assertEquals(entriesBefore, approved.getAuditHistory().size());
    }

    @Test
    void failingACheckRecordsNotesAndClearedApprovals() {
        Task task = verifiedTask();
        task.approve("dquin144");
        task.markCheckFailed(VerificationType.SECURITY, "Password is logged", "ASantana0924");
        AuditEntry entry = lastEntry(task);
        assertEquals(AuditEventType.CHECK_FAILED, entry.getEventType());
        assertEquals("ASantana0924", entry.getDeveloper());
        assertEquals("SECURITY: Password is logged. Approvals cleared: dquin144", entry.getDetails());
    }

    @Test
    void failingACheckWithNoApprovalsSaysNone() {
        Task task = startedTask();
        task.markCheckFailed(VerificationType.SECURITY, "Password is logged", "ASantana0924");
        assertEquals("SECURITY: Password is logged. Approvals cleared: none", lastEntry(task).getDetails());
    }

    @Test
    void eachApprovalRecordsTheRunningCount() {
        Task task = verifiedTask();
        task.approve("dquin144");
        AuditEntry entry = lastEntry(task);
        assertEquals(AuditEventType.APPROVAL_RECORDED, entry.getEventType());
        assertEquals("dquin144", entry.getDeveloper());
        assertEquals("1 of 2 approvals", entry.getDetails());
    }

    @Test
    void finalApprovalRecordsApprovalThenTaskApproved() {
        Task task = verifiedTask();
        task.approve("dquin144");
        task.approve("ASantana0924");
        List<AuditEntry> history = task.getAuditHistory();
        AuditEntry approval = history.get(history.size() - 2);
        AuditEntry approved = history.get(history.size() - 1);
        assertEquals(AuditEventType.APPROVAL_RECORDED, approval.getEventType());
        assertEquals("2 of 2 approvals", approval.getDetails());
        assertEquals(AuditEventType.TASK_APPROVED, approved.getEventType());
        assertEquals("ASantana0924", approved.getDeveloper());
        assertEquals("Approved by dquin144, ASantana0924", approved.getDetails());
    }

    @Test
    void rejectedActionsAddNoAuditEntries() {
        Task task = verifiedTask();
        task.approve("dquin144");
        int entriesBefore = task.getAuditHistory().size();
        assertThrows(IllegalStateException.class, () -> task.approve("dquin144"));
        assertThrows(IllegalArgumentException.class, () -> task.approve(" "));
        assertThrows(IllegalStateException.class,
                () -> task.markCheckPassed(VerificationType.TESTING, "Again", "dquin144"));
        assertThrows(IllegalArgumentException.class,
                () -> task.markCheckFailed(VerificationType.TESTING, " ", "dquin144"));
        assertEquals(entriesBefore, task.getAuditHistory().size());
    }

    @Test
    void historyKeepsEveryEntryInOrderThroughAReopen() {
        Task task = approvedTask();
        List<AuditEntry> beforeReopen = task.getAuditHistory();
        task.reopen("ASantana0924", "Found a missed edge case");
        List<AuditEntry> afterReopen = task.getAuditHistory();
        assertEquals(beforeReopen, afterReopen.subList(0, beforeReopen.size()));
        assertEquals(beforeReopen.size() + 1, afterReopen.size());
        List<AuditEventType> expected = new ArrayList<>();
        expected.add(AuditEventType.TASK_CREATED);
        for (int i = 0; i < VerificationType.values().length; i++) {
            expected.add(AuditEventType.CHECK_PASSED);
        }
        expected.add(AuditEventType.APPROVAL_RECORDED);
        expected.add(AuditEventType.APPROVAL_RECORDED);
        expected.add(AuditEventType.TASK_APPROVED);
        expected.add(AuditEventType.TASK_REOPENED);
        assertEquals(expected, eventTypes(task));
    }
}