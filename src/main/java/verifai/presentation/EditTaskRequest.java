package verifai.presentation;

/** Body of PATCH /api/tasks/{id}. Both fields are sent; unchanged values are ignored. */
public record EditTaskRequest(String title, String description, String developer) {
}
