package verifai.presentation;

import java.util.Arrays;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import verifai.domain.RuleViolationException;

/**
 * Turns every error into {status, error, message} JSON.
 *
 * IllegalArgumentException is invalid input (400) and NoSuchElementException is
 * an unknown task, artifact version, requirement, or acceptance criterion
 * (404). Only the Domain's RuleViolationException is a rule violation (409),
 * and a stale save refused by the Data tier (OptimisticLockingFailureException)
 * is a conflict (409) too. Any other exception, including a plain
 * IllegalStateException, is a bug: it is logged and returned as a 500 without
 * its message (ADR-008).
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

    @ExceptionHandler(RuleViolationException.class)
    public ResponseEntity<ErrorResponse> ruleViolation(RuleViolationException ex) {
        return error(HttpStatus.CONFLICT, ex.getMessage());
    }

    /** Another request saved the task after this one loaded it. */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> staleSave(OptimisticLockingFailureException ex) {
        return error(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> unreadableBody(HttpMessageNotReadableException ex) {
        return error(HttpStatus.BAD_REQUEST, "Request body is missing or is not valid JSON");
    }

    /** A path or query value of the wrong type. For an enum, such as a check type, the message lists the valid values. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> badPathOrParam(MethodArgumentTypeMismatchException ex) {
        String message = "Invalid value for " + ex.getName() + ": " + ex.getValue();
        Class<?> type = ex.getRequiredType();
        if (type != null && type.isEnum()) {
            String allowed = Arrays.stream(type.getEnumConstants())
                    .map(Object::toString)
                    .collect(Collectors.joining(", "));
            message += ". Expected one of: " + allowed;
        }
        return error(HttpStatus.BAD_REQUEST, message);
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
