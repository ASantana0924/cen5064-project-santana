package verifai.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;

import org.junit.jupiter.api.Test;

class TaskItemTest {

    @Test
    void createGivesEachItemANewIdAndTrimsTheText() {
        TaskItem first = TaskItem.create("  Reject blank usernames ");
        TaskItem second = TaskItem.create("Reject blank usernames");
        assertNotNull(first.id());
        assertNotEquals(first.id(), second.id());
        assertEquals("Reject blank usernames", first.text());
    }

    @Test
    void restoringKeepsTheStoredId() {
        UUID id = UUID.randomUUID();
        TaskItem item = new TaskItem(id, "Reject blank usernames");
        assertEquals(id, item.id());
        assertEquals(new TaskItem(id, "Reject blank usernames"), item);
    }

    @Test
    void idAndTextAreRequired() {
        UUID id = UUID.randomUUID();
        assertThrows(IllegalArgumentException.class, () -> new TaskItem(null, "Text"));
        assertThrows(IllegalArgumentException.class, () -> new TaskItem(id, null));
        assertThrows(IllegalArgumentException.class, () -> new TaskItem(id, "  "));
        assertThrows(IllegalArgumentException.class, () -> TaskItem.create(""));
    }
}
