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

class AuditEntryTest {

    @Test
    void storesEventDeveloperAndDetails() {
        AuditEntry entry = new AuditEntry(AuditEventType.TASK_REOPENED, "dquin144", "Security check missed an input");
        assertEquals(AuditEventType.TASK_REOPENED, entry.getEventType());
        assertEquals("dquin144", entry.getDeveloper());
        assertEquals("Security check missed an input", entry.getDetails());
    }

    @Test
    void missingDetailsBecomeEmptyText() {
        assertEquals("", new AuditEntry(AuditEventType.TASK_STARTED, "dquin144", null).getDetails());
    }

    @Test
    void recordedTimeIsSetBySystem() {
        Instant before = Instant.now();
        AuditEntry entry = new AuditEntry(AuditEventType.TASK_CREATED, "dquin144", "");
        Instant after = Instant.now();
        assertNotNull(entry.getRecordedAt());
        assertFalse(entry.getRecordedAt().isBefore(before));
        assertFalse(entry.getRecordedAt().isAfter(after));
    }

    @Test
    void missingEventTypeIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> new AuditEntry(null, "dquin144", "details"));
    }

    @Test
    void blankOrMissingDeveloperIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> new AuditEntry(AuditEventType.TASK_EDITED, null, "details"));
        assertThrows(IllegalArgumentException.class, () -> new AuditEntry(AuditEventType.TASK_EDITED, " ", "details"));
    }

    @Test
    void entryCannotBeChangedAfterCreation() {
        for (Field field : AuditEntry.class.getDeclaredFields()) {
            assertTrue(Modifier.isFinal(field.getModifiers()), "Field is not final: " + field.getName());
        }
        for (Method method : AuditEntry.class.getDeclaredMethods()) {
            boolean isPublicSetter = Modifier.isPublic(method.getModifiers())
                    && method.getName().startsWith("set");
            assertFalse(isPublicSetter, "Unexpected setter: " + method.getName());
        }
    }
}
