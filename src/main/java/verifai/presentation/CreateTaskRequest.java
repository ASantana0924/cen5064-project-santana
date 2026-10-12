package verifai.presentation;

/** Body of POST /api/tasks. The developer becomes the task owner. */
public record CreateTaskRequest(String title, String description, String developer) {
}
