package verifai.domain;

/**
 * A workflow or verification rule blocks the action, such as approving before
 * all six checks pass or editing an APPROVED task. Only the Domain throws it.
 *
 * It extends RuntimeException, not IllegalStateException, so an unexpected
 * IllegalStateException (a bug) is never mistaken for a rule violation.
 */
public class RuleViolationException extends RuntimeException {

    public RuleViolationException(String message) {
        super(message);
    }
}
