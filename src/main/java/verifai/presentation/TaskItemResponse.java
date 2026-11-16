package verifai.presentation;

import java.util.UUID;

import verifai.domain.TaskItem;

/** One requirement or acceptance criterion. The id is what a removal names (ADR-009). */
public record TaskItemResponse(UUID id, String text) {

    static TaskItemResponse from(TaskItem item) {
        return new TaskItemResponse(item.id(), item.text());
    }
}
