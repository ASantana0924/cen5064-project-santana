package verifai.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
}