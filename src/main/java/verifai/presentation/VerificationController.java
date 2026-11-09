package verifai.presentation;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import verifai.domain.VerificationType;
import verifai.service.VerificationService;

/**
 * JSON API for a task's six checks and its recorded test runs (UC-10 to UC-13).
 * Calls only VerificationService and returns DTOs. The check type in the path
 * is a VerificationType name, such as CODE_QUALITY; an unknown one is a 400.
 */
@RestController
@RequestMapping("/api/tasks/{id}")
public class VerificationController {

    private final VerificationService verificationService;

    public VerificationController(VerificationService verificationService) {
        this.verificationService = verificationService;
    }

    /** UC-13: the six checks in order, plus how many are passed, failed, and pending. */
    @GetMapping("/checks")
    public ChecksResponse listChecks(@PathVariable("id") UUID id) {
        return ChecksResponse.from(verificationService.listChecks(id));
    }

    /** UC-11: marks the check PASSED. Evidence is required. */
    @PostMapping("/checks/{type}/pass")
    public CheckResponse markPassed(@PathVariable("id") UUID id, @PathVariable("type") VerificationType type,
            @RequestBody PassCheckRequest request) {
        return CheckResponse.from(verificationService.markPassed(id, type, request.evidence(), request.reviewer()));
    }

    /** UC-12: marks the check FAILED. Notes are required, and all approvals are cleared. */
    @PostMapping("/checks/{type}/fail")
    public CheckResponse markFailed(@PathVariable("id") UUID id, @PathVariable("type") VerificationType type,
            @RequestBody FailCheckRequest request) {
        return CheckResponse.from(verificationService.markFailed(id, type, request.notes(), request.reviewer()));
    }

    /**
     * UC-10: records an automated test run as evidence for the TESTING check.
     * It never changes the check's status. There is no endpoint for a single
     * run, so the 201 response has no Location header.
     */
    @PostMapping("/test-runs")
    public ResponseEntity<TestRunResponse> recordTestRun(@PathVariable("id") UUID id,
            @RequestBody RecordTestRunRequest request) {
        TestRunResponse run = TestRunResponse.from(verificationService.recordTestRun(id, request.tool(),
                request.total(), request.passed(), request.failed(), request.summary(), request.developer()));
        return ResponseEntity.status(HttpStatus.CREATED).body(run);
    }

    /** UC-10: lists every recorded test run, newest first. */
    @GetMapping("/test-runs")
    public List<TestRunResponse> listTestRuns(@PathVariable("id") UUID id) {
        return verificationService.listTestRuns(id).stream().map(TestRunResponse::from).toList();
    }
}
