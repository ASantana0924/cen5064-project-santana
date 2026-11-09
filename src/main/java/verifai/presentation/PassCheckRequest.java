package verifai.presentation;

/** Body of POST /api/tasks/{id}/checks/{type}/pass. */
public record PassCheckRequest(String evidence, String reviewer) {
}
