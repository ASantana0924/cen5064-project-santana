package verifai.domain;

import java.util.UUID;

/**
 * One requirement or acceptance criterion of a task. Its id is made when the
 * item is added and never changes or is reused, so a removal names exactly
 * one item even if other items were removed first (ADR-009). Items are never
 * edited: a changed item is removed and a new one added.
 */
public record TaskItem(UUID id, String text) {

    /** Rebuilds an item with its stored id. Use {@link #create(String)} for a new one. */
    public TaskItem {
        if (id == null) {
            throw new IllegalArgumentException("Item id is required");
        }
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Item text is required");
        }
        text = text.strip();
    }

    /** A new item with a new id. */
    public static TaskItem create(String text) {
        return new TaskItem(UUID.randomUUID(), text);
    }
}
