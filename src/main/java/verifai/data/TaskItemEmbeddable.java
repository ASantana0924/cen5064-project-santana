package verifai.data;

import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * One row of the task_requirements or task_acceptance_criteria table. Its
 * position is the order column in TaskEntity.
 */
@Embeddable
class TaskItemEmbeddable {

    @Column(nullable = false)
    private UUID id;

    @Column(nullable = false)
    private String text;

    protected TaskItemEmbeddable() {
        // For JPA.
    }

    TaskItemEmbeddable(UUID id, String text) {
        this.id = id;
        this.text = text;
    }

    UUID getId() { return id; }
    String getText() { return text; }

    /** Equal when the id and text match, so TaskMapper can skip a list that did not change. */
    @Override
    public boolean equals(Object other) {
        return other instanceof TaskItemEmbeddable item && id.equals(item.id) && text.equals(item.text);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, text);
    }
}
