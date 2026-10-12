package verifai.presentation;

import java.util.NoSuchElementException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Turns every error into {status, error, message} JSON.
 *
 * The Domain and Service tiers signal problems with standard exceptions:
 * IllegalArgumentException for invalid input (400), NoSuchElementException for
 * an unknown task (404), and IllegalStateException for a rule violation (409).
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> invalidInput(IllegalArgumentException ex) {
        return error(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ErrorResponse> notFound(NoSuchElementException ex) {
        return error(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> ruleViolation(IllegalStateException ex) {
        return error(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> unreadableBody(HttpMessageNotReadableException ex) {
        return error(HttpStatus.BAD_REQUEST, "Request body is missing or is not valid JSON");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> badPathOrParam(MethodArgumentTypeMismatchException ex) {
        return error(HttpStatus.BAD_REQUEST, "Invalid value for " + ex.getName() + ": " + ex.getValue());
    }

    /**
     * Spring's own errors (unknown URL, wrong HTTP method, and so on) keep their
     * status. Anything else is a bug: log it and hide the details from the client.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> other(Exception ex) {
        if (ex instanceof org.springframework.web.ErrorResponse springError) {
            return error(springError.getStatusCode(), springError.getBody().getDetail());
        }
        log.error("Unexpected error", ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected server error");
    }

    private static ResponseEntity<ErrorResponse> error(HttpStatusCode code, String message) {
        HttpStatus status = HttpStatus.resolve(code.value());
        String reason = status == null ? "Error" : status.getReasonPhrase();
        return ResponseEntity.status(code).body(new ErrorResponse(code.value(), reason, message));
    }
}
