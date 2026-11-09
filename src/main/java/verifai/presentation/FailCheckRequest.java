package verifai.presentation;

/** Body of POST /api/tasks/{id}/checks/{type}/fail. */
public record FailCheckRequest(String notes, String reviewer) {
}
