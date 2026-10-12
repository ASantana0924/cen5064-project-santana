package verifai;

import java.util.UUID;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import verifai.domain.VerificationType;
import verifai.service.ApprovalService;
import verifai.service.ArtifactService;
import verifai.service.TaskService;
import verifai.service.VerificationService;

/**
 * Seeds four sample tasks, one at each stage of the workflow, when the app runs
 * with the demo profile. Everything goes through the services, so every rule
 * applies and every step appears in the audit history.
 */
@Component
@Profile("demo")
public class DemoData implements ApplicationRunner {

    private final TaskService tasks;
    private final ArtifactService artifacts;
    private final VerificationService checks;
    private final ApprovalService approvals;

    public DemoData(TaskService tasks, ArtifactService artifacts,
            VerificationService checks, ApprovalService approvals) {
        this.tasks = tasks;
        this.artifacts = artifacts;
        this.checks = checks;
        this.approvals = approvals;
    }

    @Override
    public void run(ApplicationArguments args) {
        // DRAFT with nothing defined yet.
        tasks.createTask("Add password reset email",
                "Send a reset link that expires after 30 minutes.", "alex");

        // DRAFT and ready to start.
        UUID signup = tasks.createTask("Validate the signup form",
                "Check email format and password strength before submitting.", "dana").getId();
        tasks.addRequirement(signup, "Reject emails without an @ and a domain", "dana");
        tasks.addAcceptanceCriterion(signup, "An invalid email shows an error under the field", "dana");

        // IN_PROGRESS with an artifact and half the checks passed.
        UUID rateLimit = tasks.createTask("Rate limit login attempts",
                "Lock an account for 15 minutes after 5 failed logins.", "sam").getId();
        tasks.addRequirement(rateLimit, "Count failed logins per account", "sam");
        tasks.addRequirement(rateLimit, "Reset the count after a successful login", "sam");
        tasks.addAcceptanceCriterion(rateLimit, "The sixth failed login within 15 minutes is refused", "sam");
        tasks.startTask(rateLimit, "sam");
        artifacts.recordArtifact(rateLimit, "Write a login rate limiter in Spring", "Claude",
                "public class LoginRateLimiter { /* ... */ }", "sam");
        checks.markPassed(rateLimit, VerificationType.REQUIREMENTS, "Matches both requirements", "dana");
        checks.markPassed(rateLimit, VerificationType.FUNCTIONALITY, "Tried 6 logins by hand", "dana");
        checks.markPassed(rateLimit, VerificationType.TESTING, "LoginRateLimiterTest passes", "sam");

        // APPROVED: all six checks passed and two approvals.
        UUID hashing = tasks.createTask("Hash stored passwords with bcrypt",
                "Replace plain SHA-256 hashes with bcrypt.", "alex").getId();
        tasks.addRequirement(hashing, "New passwords are stored as bcrypt hashes", "alex");
        tasks.addAcceptanceCriterion(hashing, "No stored password starts with anything but $2", "alex");
        tasks.startTask(hashing, "alex");
        artifacts.recordArtifact(hashing, "Switch password hashing to bcrypt", "GitHub Copilot",
                "passwordEncoder = new BCryptPasswordEncoder();", "alex");
        for (VerificationType type : VerificationType.values()) {
            checks.markPassed(hashing, type, "Reviewed " + type.name().toLowerCase(), "dana");
        }
        approvals.approve(hashing, "alex");
        approvals.approve(hashing, "dana");
    }
}
