package verifai.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.time.Instant;

import org.junit.jupiter.api.Test;

class ApprovalTest {

    @Test
    void storesDeveloper() {
        assertEquals("dquin144", new Approval("dquin144").getDeveloper());
    }

    @Test
    void developerNameIsTrimmed() {
        assertEquals("dquin144", new Approval("  dquin144 ").getDeveloper());
    }

    @Test
    void approvalTimeIsSetBySystem() {
        Instant before = Instant.now();
        Approval approval = new Approval("dquin144");
        Instant after = Instant.now();
        assertNotNull(approval.getApprovedAt());
        assertFalse(approval.getApprovedAt().isBefore(before));
        assertFalse(approval.getApprovedAt().isAfter(after));
    }

    @Test
    void blankOrMissingDeveloperIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> new Approval(null));
        assertThrows(IllegalArgumentException.class, () -> new Approval(""));
        assertThrows(IllegalArgumentException.class, () -> new Approval("   "));
    }

    @Test
    void approvalCannotBeChangedAfterCreation() {
        for (Field field : Approval.class.getDeclaredFields()) {
            assertTrue(Modifier.isFinal(field.getModifiers()), "Field is not final: " + field.getName());
        }
        for (Method method : Approval.class.getDeclaredMethods()) {
            boolean isPublicSetter = Modifier.isPublic(method.getModifiers())
                    && method.getName().startsWith("set");
            assertFalse(isPublicSetter, "Unexpected setter: " + method.getName());
        }
    }
}
