package verifai.presentation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
 * Controller tests for checks. Where a rule matters, the mocked service runs
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
}
