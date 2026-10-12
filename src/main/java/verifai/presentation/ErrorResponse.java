package verifai.presentation;

/** JSON body of every error: the HTTP status code, its reason phrase, and a readable message. */
public record ErrorResponse(int status, String error, String message) {
}
