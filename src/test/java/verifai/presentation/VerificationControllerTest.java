package verifai.presentation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import verifai.domain.Task;
import verifai.domain.VerificationStatus;
import verifai.domain.VerificationType;
import verifai.service.VerificationService;

/**
 * Controller tests for checks and test runs. Where a rule matters, the mocked service runs
 * the real Domain method, so the status code comes from the actual rule.
 */
@WebMvcTest(VerificationController.class)
class VerificationControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private VerificationService verificationService;

    private Task readyTask() {
        Task task = new Task("Add login check", "Validate usernames", "alex");
        task.addRequirement("Blank usernames are rejected", "alex");
        task.addAcceptanceCriterion("Submitting a blank username shows an error", "alex");
        return task;
    }

    private Task startedTask() {
        Task task = readyTask();
        task.start("alex");
        task.recordArtifact("Write a login check", "Claude", "v1 code", "alex");
        return task;
    }

    /** Lets the mocked service mark checks on the real task, so Task applies the rules. */
    private void markOn(Task task) {
        when(verificationService.markPassed(eq(task.getId()), any(), any(), any())).thenAnswer(inv -> {
            VerificationType type = inv.getArgument(1);
            task.markCheckPassed(type, inv.getArgument(2), inv.getArgument(3));
            return task.getVerification(type);
        });
        when(verificationService.markFailed(eq(task.getId()), any(), any(), any())).thenAnswer(inv -> {
            VerificationType type = inv.getArgument(1);
            task.markCheckFailed(type, inv.getArgument(2), inv.getArgument(3));
            return task.getVerification(type);
        });
    }

    private ResultActions pass(Task task, String type, String json) throws Exception {
        return mvc.perform(post("/api/tasks/" + task.getId() + "/checks/" + type + "/pass")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private ResultActions fail(Task task, String type, String json) throws Exception {
        return mvc.perform(post("/api/tasks/" + task.getId() + "/checks/" + type + "/fail")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    // List with summary (UC-13)

    @Test
    void listReturnsSixChecksInOrderWithSummary() throws Exception {
        Task task = startedTask();
        task.markCheckPassed(VerificationType.REQUIREMENTS, "Matches both requirements", "dana");
        task.markCheckPassed(VerificationType.TESTING, "All 12 tests pass", "dana");
        task.markCheckFailed(VerificationType.SECURITY, "Password is logged", "sam");
        when(verificationService.listChecks(task.getId())).thenReturn(task.getVerifications());

        mvc.perform(get("/api/tasks/" + task.getId() + "/checks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checks.length()").value(6))
                .andExpect(jsonPath("$.checks[0].type").value("REQUIREMENTS"))
                .andExpect(jsonPath("$.checks[0].status").value("PASSED"))
                .andExpect(jsonPath("$.checks[0].evidence").value("Matches both requirements"))
                .andExpect(jsonPath("$.checks[0].reviewer").value("dana"))
                .andExpect(jsonPath("$.checks[0].reviewedOn").isNotEmpty())
                .andExpect(jsonPath("$.checks[1].type").value("FUNCTIONALITY"))
                .andExpect(jsonPath("$.checks[1].status").value("PENDING"))
                .andExpect(jsonPath("$.checks[2].type").value("TESTING"))
                .andExpect(jsonPath("$.checks[3].type").value("ARCHITECTURE"))
                .andExpect(jsonPath("$.checks[4].type").value("CODE_QUALITY"))
                .andExpect(jsonPath("$.checks[5].type").value("SECURITY"))
                .andExpect(jsonPath("$.checks[5].status").value("FAILED"))
                .andExpect(jsonPath("$.checks[5].notes").value("Password is logged"))
                .andExpect(jsonPath("$.summary.passed").value(2))
                .andExpect(jsonPath("$.summary.failed").value(1))
                .andExpect(jsonPath("$.summary.pending").value(3))
                .andExpect(jsonPath("$.summary.total").value(6));
    }

    @Test
    void unknownTaskReturns404() throws Exception {
        UUID id = UUID.randomUUID();
        when(verificationService.listChecks(id)).thenThrow(new NoSuchElementException("No task with id " + id));

        mvc.perform(get("/api/tasks/" + id + "/checks"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("No task with id " + id));
    }

    // Pass (UC-11)

    @Test
    void passReturnsTheUpdatedCheck() throws Exception {
        Task task = startedTask();
        markOn(task);

        pass(task, "CODE_QUALITY", "{\"evidence\":\"Reviewed naming and structure\",\"reviewer\":\"dana\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("CODE_QUALITY"))
                .andExpect(jsonPath("$.status").value("PASSED"))
                .andExpect(jsonPath("$.evidence").value("Reviewed naming and structure"))
                .andExpect(jsonPath("$.notes").isEmpty())
                .andExpect(jsonPath("$.reviewer").value("dana"))
                .andExpect(jsonPath("$.reviewedOn").isNotEmpty());
        assertEquals(VerificationStatus.PASSED, task.getVerification(VerificationType.CODE_QUALITY).getStatus());
    }

    @Test
    void passWithoutEvidenceReturns409() throws Exception {
        Task task = startedTask();
        markOn(task);

        pass(task, "TESTING", "{\"evidence\":\" \",\"reviewer\":\"dana\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message").value("Evidence is required to pass a check"));
        pass(task, "TESTING", "{\"reviewer\":\"dana\"}")
                .andExpect(status().isConflict());
        assertEquals(VerificationStatus.PENDING, task.getVerification(VerificationType.TESTING).getStatus());
    }

    @Test
    void passWithoutReviewerReturns400() throws Exception {
        Task task = startedTask();
        markOn(task);

        pass(task, "TESTING", "{\"evidence\":\"All tests pass\",\"reviewer\":\"\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Reviewer is required"));
    }

    @Test
    void passingACheckOnADraftTaskReturns409() throws Exception {
        Task draft = readyTask();
        markOn(draft);

        pass(draft, "TESTING", "{\"evidence\":\"All tests pass\",\"reviewer\":\"dana\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Checks can only be passed on an IN_PROGRESS task"));
    }

    // Fail (UC-12)

    @Test
    void failReturnsTheUpdatedCheckAndClearsApprovals() throws Exception {
        Task task = startedTask();
        for (VerificationType type : VerificationType.values()) {
            task.markCheckPassed(type, "Reviewed " + type, "dana");
        }
        task.approve("dana");
        markOn(task);

        fail(task, "SECURITY", "{\"notes\":\"Password is logged in plain text\",\"reviewer\":\"sam\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("SECURITY"))
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.notes").value("Password is logged in plain text"))
                .andExpect(jsonPath("$.evidence").isEmpty())
                .andExpect(jsonPath("$.reviewer").value("sam"));
        assertTrue(task.getApprovals().isEmpty());
    }

    @Test
    void failWithoutNotesReturns409() throws Exception {
        Task task = startedTask();
        markOn(task);

        fail(task, "SECURITY", "{\"notes\":\"\",\"reviewer\":\"sam\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Notes are required to fail a check"));
        assertEquals(VerificationStatus.PENDING, task.getVerification(VerificationType.SECURITY).getStatus());
    }

    // Path and body errors

    @Test
    void unknownCheckTypeReturns400Json() throws Exception {
        Task task = startedTask();

        pass(task, "SPEED", "{\"evidence\":\"Fast\",\"reviewer\":\"dana\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Invalid value for type: SPEED. Expected one of: "
                        + "REQUIREMENTS, FUNCTIONALITY, TESTING, ARCHITECTURE, CODE_QUALITY, SECURITY"));
        fail(task, "SPEED", "{\"notes\":\"Slow\",\"reviewer\":\"dana\"}")
                .andExpect(status().isBadRequest());
        verifyNoInteractions(verificationService);
    }

    @Test
    void markWithoutBodyReturns400() throws Exception {
        mvc.perform(post("/api/tasks/" + UUID.randomUUID() + "/checks/TESTING/pass"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Request body is missing or is not valid JSON"));
        verifyNoInteractions(verificationService);
    }

    // Test runs (UC-10)

    /** Lets the mocked service record test runs on the real task, so Task applies the rules. */
    private void recordTestRunsOn(Task task) {
        when(verificationService.recordTestRun(eq(task.getId()), any(), any(), any(), any(), any(), any()))
                .thenAnswer(inv -> task.recordTestRun(inv.getArgument(1), inv.getArgument(2), inv.getArgument(3),
                        inv.getArgument(4), inv.getArgument(5), inv.getArgument(6)));
    }

    private ResultActions recordTestRun(Task task, String json) throws Exception {
        return mvc.perform(post("/api/tasks/" + task.getId() + "/test-runs")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private static String testRunJson(int total, int passed, int failed) {
        return "{\"tool\":\"JUnit\",\"total\":" + total + ",\"passed\":" + passed + ",\"failed\":" + failed
                + ",\"summary\":\"LoginCheckTest\",\"developer\":\"sam\"}";
    }

    @Test
    void recordTestRunReturns201WithTheRunAndTheCurrentArtifactVersion() throws Exception {
        Task task = startedTask();
        task.recordArtifact("Handle null input", "Claude", "v2 code", "alex");
        recordTestRunsOn(task);

        recordTestRun(task, "{\"tool\":\"JUnit\",\"total\":14,\"passed\":12,\"failed\":1,"
                + "\"summary\":\"1 failure in LoginCheckTest\",\"developer\":\"sam\"}")
                .andExpect(status().isCreated())
                .andExpect(header().doesNotExist("Location"))
                .andExpect(jsonPath("$.tool").value("JUnit"))
                .andExpect(jsonPath("$.total").value(14))
                .andExpect(jsonPath("$.passed").value(12))
                .andExpect(jsonPath("$.failed").value(1))
                .andExpect(jsonPath("$.skipped").value(1))
                .andExpect(jsonPath("$.summary").value("1 failure in LoginCheckTest"))
                .andExpect(jsonPath("$.recordedBy").value("sam"))
                .andExpect(jsonPath("$.recordedAt").isNotEmpty())
                .andExpect(jsonPath("$.artifactVersion").value(2));
        assertEquals(1, task.getTestRuns().size());
    }

    @Test
    void recordingATestRunLeavesTheTestingCheckStatusUnchanged() throws Exception {
        Task task = startedTask();
        recordTestRunsOn(task);

        recordTestRun(task, testRunJson(10, 10, 0)).andExpect(status().isCreated());
        assertEquals(VerificationStatus.PENDING, task.getVerification(VerificationType.TESTING).getStatus());

        task.markCheckPassed(VerificationType.TESTING, "Reviewed the test plan", "dana");
        recordTestRun(task, testRunJson(10, 3, 7)).andExpect(status().isCreated());
        assertEquals(VerificationStatus.PASSED, task.getVerification(VerificationType.TESTING).getStatus());
    }

    @Test
    void summaryIsOptional() throws Exception {
        Task task = startedTask();
        recordTestRunsOn(task);

        recordTestRun(task, "{\"tool\":\"JUnit\",\"total\":3,\"passed\":3,\"failed\":0,\"developer\":\"sam\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.summary").value(""));
    }

    @Test
    void invalidCountsReturn400() throws Exception {
        Task task = startedTask();
        recordTestRunsOn(task);

        recordTestRun(task, testRunJson(10, -1, 0))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Passed cannot be negative"));
        recordTestRun(task, testRunJson(10, 8, 3))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Passed plus failed cannot be more than the total"));
        recordTestRun(task, testRunJson(0, 0, 0))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("A test run must include at least one test"));
        recordTestRun(task, "{\"tool\":\"JUnit\",\"passed\":3,\"failed\":0,\"developer\":\"sam\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Total is required"));
        assertTrue(task.getTestRuns().isEmpty());
    }

    @Test
    void missingToolOrDeveloperReturns400() throws Exception {
        Task task = startedTask();
        recordTestRunsOn(task);

        recordTestRun(task, "{\"tool\":\" \",\"total\":3,\"passed\":3,\"failed\":0,\"developer\":\"sam\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Tool is required"));
        recordTestRun(task, "{\"tool\":\"JUnit\",\"total\":3,\"passed\":3,\"failed\":0}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Developer is required"));
    }

    @Test
    void nonNumericCountReturns400() throws Exception {
        recordTestRun(startedTask(), "{\"tool\":\"JUnit\",\"total\":\"many\",\"passed\":3,\"failed\":0,"
                + "\"developer\":\"sam\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Request body is missing or is not valid JSON"));
        verifyNoInteractions(verificationService);
    }

    @Test
    void recordingATestRunOnADraftOrApprovedTaskReturns409() throws Exception {
        Task draft = readyTask();
        recordTestRunsOn(draft);
        Task approved = startedTask();
        for (VerificationType type : VerificationType.values()) {
            approved.markCheckPassed(type, "Reviewed " + type, "dana");
        }
        approved.approve("alex");
        approved.approve("dana");
        recordTestRunsOn(approved);

        recordTestRun(draft, testRunJson(3, 3, 0))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Test runs can only be recorded on an IN_PROGRESS task"));
        recordTestRun(approved, testRunJson(3, 3, 0))
                .andExpect(status().isConflict());
        assertTrue(draft.getTestRuns().isEmpty());
        assertTrue(approved.getTestRuns().isEmpty());
    }

    @Test
    void listReturnsTestRunsInTheOrderTheServiceGives() throws Exception {
        Task task = startedTask();
        task.recordTestRun("JUnit", 10, 8, 2, "First", "sam");
        task.recordTestRun("JUnit", 10, 10, 0, "Second", "dana");
        when(verificationService.listTestRuns(task.getId())).thenReturn(task.getTestRuns().reversed());

        mvc.perform(get("/api/tasks/" + task.getId() + "/test-runs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].summary").value("Second"))
                .andExpect(jsonPath("$[0].recordedBy").value("dana"))
                .andExpect(jsonPath("$[0].artifactVersion").value(1))
                .andExpect(jsonPath("$[1].summary").value("First"))
                .andExpect(jsonPath("$[1].failed").value(2));
    }

    @Test
    void listIsEmptyArrayWhenNoTestRunsWereRecorded() throws Exception {
        UUID id = UUID.randomUUID();
        when(verificationService.listTestRuns(id)).thenReturn(List.of());

        mvc.perform(get("/api/tasks/" + id + "/test-runs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void testRunsOfUnknownTaskReturn404() throws Exception {
        UUID id = UUID.randomUUID();
        when(verificationService.listTestRuns(id)).thenThrow(new NoSuchElementException("No task with id " + id));

        mvc.perform(get("/api/tasks/" + id + "/test-runs"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("No task with id " + id));
    }

    @Test
    void recordTestRunWithoutBodyReturns400() throws Exception {
        mvc.perform(post("/api/tasks/" + UUID.randomUUID() + "/test-runs"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Request body is missing or is not valid JSON"));
        verifyNoInteractions(verificationService);
    }
}
