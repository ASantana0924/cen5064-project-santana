package verifai.presentation;

import static org.hamcrest.Matchers.endsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
import verifai.domain.Verification;
import verifai.domain.VerificationStatus;
import verifai.domain.VerificationType;
import verifai.service.ArtifactService;

/**
 * Controller tests for artifacts. Where a rule matters, the mocked service runs
 * the real Domain method, so the status code comes from the actual rule.
 */
@WebMvcTest(ArtifactController.class)
class ArtifactControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private ArtifactService artifactService;

    private Task startedTask() {
        Task task = new Task("Add login check", "Validate usernames", "alex");
        task.addRequirement("Blank usernames are rejected", "alex");
        task.addAcceptanceCriterion("Submitting a blank username shows an error", "alex");
        task.start("alex");
        return task;
    }

    /** Lets the mocked service record artifacts on the real task, so Task assigns versions and resets checks. */
    private void recordOn(Task task) {
        when(artifactService.recordArtifact(eq(task.getId()), any(), any(), any(), any())).thenAnswer(inv ->
                task.recordArtifact(inv.getArgument(1), inv.getArgument(2), inv.getArgument(3), inv.getArgument(4)));
    }

    private ResultActions record(Task task, String prompt, String aiTool, String code, String developer)
            throws Exception {
        String json = "{\"prompt\":\"" + prompt + "\",\"aiTool\":\"" + aiTool
                + "\",\"codeContent\":\"" + code + "\",\"developer\":\"" + developer + "\"}";
        return mvc.perform(post("/api/tasks/" + task.getId() + "/artifacts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    // Record (UC-07, UC-08)

    @Test
    void recordReturns201WithLocationAndTheSystemAssignedVersion() throws Exception {
        Task task = startedTask();
        recordOn(task);

        record(task, "Write a login check", "Claude", "boolean ok() { return true; }", "alex")
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", endsWith("/api/tasks/" + task.getId() + "/artifacts/1")))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.prompt").value("Write a login check"))
                .andExpect(jsonPath("$.aiTool").value("Claude"))
                .andExpect(jsonPath("$.codeContent").value("boolean ok() { return true; }"))
                .andExpect(jsonPath("$.recordedBy").value("alex"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    @Test
    void secondArtifactGetsTheNextVersion() throws Exception {
        Task task = startedTask();
        recordOn(task);

        record(task, "Write a login check", "Claude", "v1 code", "alex").andExpect(status().isCreated());
        record(task, "Handle null input", "Copilot", "v2 code", "dana")
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", endsWith("/artifacts/2")))
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.recordedBy").value("dana"));
    }

    @Test
    void newVersionResetsAllChecksToPendingAndClearsApprovals() throws Exception {
        Task task = startedTask();
        task.recordArtifact("Write a login check", "Claude", "v1 code", "alex");
        for (VerificationType type : VerificationType.values()) {
            task.markCheckPassed(type, "Reviewed " + type, "dana");
        }
        task.approve("dana");
        recordOn(task);

        record(task, "Fix SQL injection", "Claude", "v2 code", "alex")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.version").value(2));

        for (Verification check : task.getVerifications()) {
            assertEquals(VerificationStatus.PENDING, check.getStatus(), check.getType() + " was not reset");
        }
        assertTrue(task.getApprovals().isEmpty());
    }

    @Test
    void recordingOnADraftTaskReturns409() throws Exception {
        Task draft = new Task("Add login check", "", "alex");
        recordOn(draft);

        record(draft, "Write a login check", "Claude", "code", "alex")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Artifacts can only be recorded on an IN_PROGRESS task"));
    }

    @Test
    void recordingWithABlankFieldReturns400() throws Exception {
        Task task = startedTask();
        recordOn(task);

        record(task, " ", "Claude", "code", "alex")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Prompt is required"));
        record(task, "Write a login check", "Claude", "code", "")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Developer is required"));
    }

    @Test
    void recordWithoutBodyReturns400() throws Exception {
        mvc.perform(post("/api/tasks/" + UUID.randomUUID() + "/artifacts"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Request body is missing or is not valid JSON"));
        verifyNoInteractions(artifactService);
    }

    // Version history (UC-09)

    @Test
    void listReturnsSummariesOldestFirstWithoutCode() throws Exception {
        Task task = startedTask();
        task.recordArtifact("Write a login check", "Claude", "v1 code", "alex");
        task.recordArtifact("Handle null input", "Copilot", "v2 code", "dana");
        when(artifactService.listVersions(task.getId())).thenReturn(task.getArtifacts());

        mvc.perform(get("/api/tasks/" + task.getId() + "/artifacts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].version").value(1))
                .andExpect(jsonPath("$[0].aiTool").value("Claude"))
                .andExpect(jsonPath("$[0].recordedBy").value("alex"))
                .andExpect(jsonPath("$[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$[1].version").value(2))
                .andExpect(jsonPath("$[1].recordedBy").value("dana"))
                .andExpect(jsonPath("$[0].codeContent").doesNotExist())
                .andExpect(jsonPath("$[0].prompt").doesNotExist());
    }

    @Test
    void listIsEmptyBeforeTheFirstArtifact() throws Exception {
        Task task = startedTask();
        when(artifactService.listVersions(task.getId())).thenReturn(task.getArtifacts());

        mvc.perform(get("/api/tasks/" + task.getId() + "/artifacts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void getVersionReturnsTheFullArtifact() throws Exception {
        Task task = startedTask();
        task.recordArtifact("Write a login check", "Claude", "v1 code", "alex");
        task.recordArtifact("Handle null input", "Copilot", "v2 code", "dana");
        when(artifactService.getVersion(task.getId(), 1)).thenReturn(task.getArtifacts().get(0));

        mvc.perform(get("/api/tasks/" + task.getId() + "/artifacts/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.prompt").value("Write a login check"))
                .andExpect(jsonPath("$.aiTool").value("Claude"))
                .andExpect(jsonPath("$.codeContent").value("v1 code"))
                .andExpect(jsonPath("$.recordedBy").value("alex"));
    }

    @Test
    void unknownVersionReturns404Json() throws Exception {
        Task task = startedTask();
        when(artifactService.getVersion(eq(task.getId()), anyInt())).thenThrow(
                new NoSuchElementException("Task " + task.getId() + " has no artifact version 7"));

        mvc.perform(get("/api/tasks/" + task.getId() + "/artifacts/7"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("Task " + task.getId() + " has no artifact version 7"));
    }

    @Test
    void nonNumericVersionReturns400() throws Exception {
        mvc.perform(get("/api/tasks/" + UUID.randomUUID() + "/artifacts/latest"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Invalid value for version: latest"));
        verifyNoInteractions(artifactService);
    }

    @Test
    void unknownTaskReturns404() throws Exception {
        UUID id = UUID.randomUUID();
        when(artifactService.listVersions(id)).thenThrow(new NoSuchElementException("No task with id " + id));

        mvc.perform(get("/api/tasks/" + id + "/artifacts"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("No task with id " + id));
    }
}
