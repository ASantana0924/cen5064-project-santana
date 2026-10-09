package verifai.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
}