package verifai.presentation;

/** Body of POST /api/tasks/{id}/reopen. The reason is required and kept in the audit history. */
public record ReopenRequest(String developer, String reason) {
}
