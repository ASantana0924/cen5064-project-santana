package verifai;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;

import verifai.domain.VerificationType;

/**
 * Walks one task through the whole workflow over HTTP, with the real services
 * and the in-memory repository, to check that every controller is wired up.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ApiWorkflowTest {

    @Autowired
    private MockMvc mvc;

    private ResultActions postJson(String path, String json) throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private static String artifactJson(String developer) {
        return "{\"prompt\":\"Write a login check\",\"aiTool\":\"Claude\","
                + "\"codeContent\":\"boolean ok(String u) { return !u.isBlank(); }\",\"developer\":\"" + developer + "\"}";
    }

    @Test
    void taskGoesFromDraftToApprovedToReopenedWithFullAuditHistory() throws Exception {
        String body = postJson("/api/tasks",
                "{\"title\":\"Add login check\",\"description\":\"Reject blank usernames\",\"developer\":\"alex\"}")
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String task = "/api/tasks/" + JsonPath.read(body, "$.id");

        postJson(task + "/requirements", "{\"text\":\"Blank usernames are rejected\",\"developer\":\"alex\"}")
                .andExpect(status().isOk());
        postJson(task + "/acceptance-criteria", "{\"text\":\"A blank username shows an error\",\"developer\":\"alex\"}")
                .andExpect(status().isOk());
        postJson(task + "/start", "{\"developer\":\"alex\"}")
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        postJson(task + "/artifacts", artifactJson("alex"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.version").value(1));

        for (VerificationType type : VerificationType.values()) {
            postJson(task + "/checks/" + type + "/pass", "{\"evidence\":\"Reviewed " + type + "\",\"reviewer\":\"dana\"}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("PASSED"));
        }
        mvc.perform(get(task + "/checks"))
                .andExpect(jsonPath("$.summary.passed").value(6))
                .andExpect(jsonPath("$.summary.pending").value(0));

        postJson(task + "/approvals", "{\"developer\":\"alex\"}")
                .andExpect(jsonPath("$.progress").value("1 of 2"))
                .andExpect(jsonPath("$.taskStatus").value("IN_PROGRESS"));
        postJson(task + "/approvals", "{\"developer\":\"alex\"}")
                .andExpect(status().isConflict());
        postJson(task + "/approvals", "{\"developer\":\"dana\"}")
                .andExpect(jsonPath("$.progress").value("2 of 2"))
                .andExpect(jsonPath("$.taskStatus").value("APPROVED"));

        postJson(task + "/reopen", "{\"developer\":\"sam\",\"reason\":\"Found a missed edge case\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.checks[*].status", everyItem(is("PENDING"))))
                .andExpect(jsonPath("$.approvals.length()").value(0));

        postJson(task + "/artifacts", artifactJson("sam"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.recordedBy").value("sam"));
        mvc.perform(get(task + "/artifacts"))
                .andExpect(jsonPath("$[*].version", contains(1, 2)));

        mvc.perform(get(task + "/audit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].eventType").value("TASK_CREATED"))
                .andExpect(jsonPath("$[?(@.eventType == 'APPROVAL_RECORDED')].developer", contains("alex", "dana")))
                .andExpect(jsonPath("$[?(@.eventType == 'TASK_REOPENED')].details",
                        contains(startsWith("Reason: Found a missed edge case"))))
                .andExpect(jsonPath("$[-1].eventType").value("ARTIFACT_RECORDED"));
    }

    private static String testRunJson(int total, int passed, int failed, String summary) {
        return "{\"tool\":\"JUnit\",\"total\":" + total + ",\"passed\":" + passed + ",\"failed\":" + failed
                + ",\"summary\":\"" + summary + "\",\"developer\":\"sam\"}";
    }

    @Test
    void testRunsAreRecordedAsEvidenceWithoutChangingTheTestingCheck() throws Exception {
        String body = postJson("/api/tasks",
                "{\"title\":\"Add login check\",\"description\":\"\",\"developer\":\"alex\"}")
                .andReturn().getResponse().getContentAsString();
        String task = "/api/tasks/" + JsonPath.read(body, "$.id");

        postJson(task + "/test-runs", testRunJson(3, 3, 0, "Too early"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Test runs can only be recorded on an IN_PROGRESS task"));

        postJson(task + "/requirements", "{\"text\":\"Blank usernames are rejected\",\"developer\":\"alex\"}");
        postJson(task + "/acceptance-criteria", "{\"text\":\"A blank username shows an error\",\"developer\":\"alex\"}");
        postJson(task + "/start", "{\"developer\":\"alex\"}")
                .andExpect(jsonPath("$.latestTestRun").value(nullValue()));

        postJson(task + "/test-runs", testRunJson(3, 3, 0, "Before any artifact"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.artifactVersion").value(nullValue()));
        postJson(task + "/artifacts", artifactJson("alex")).andExpect(status().isCreated());
        postJson(task + "/test-runs", testRunJson(10, 7, 3, "3 failures"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.artifactVersion").value(1));
        postJson(task + "/test-runs", testRunJson(10, 8, 3, "Too many"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Passed plus failed cannot be more than the total"));

        mvc.perform(get(task + "/checks"))
                .andExpect(jsonPath("$.checks[2].type").value("TESTING"))
                .andExpect(jsonPath("$.checks[2].status").value("PENDING"));
        postJson(task + "/checks/TESTING/pass", "{\"evidence\":\"Reviewed the test plan\",\"reviewer\":\"dana\"}")
                .andExpect(status().isOk());
        postJson(task + "/test-runs", testRunJson(10, 10, 0, "All pass"))
                .andExpect(status().isCreated());
        mvc.perform(get(task + "/checks"))
                .andExpect(jsonPath("$.checks[2].status").value("PASSED"))
                .andExpect(jsonPath("$.checks[2].evidence").value("Reviewed the test plan"));

        mvc.perform(get(task + "/test-runs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].summary", contains("All pass", "3 failures", "Before any artifact")))
                .andExpect(jsonPath("$[*].artifactVersion", contains(1, 1, null)));
        mvc.perform(get(task))
                .andExpect(jsonPath("$.latestTestRun.summary").value("All pass"))
                .andExpect(jsonPath("$.latestTestRun.artifactVersion").value(1));
        mvc.perform(get(task + "/audit"))
                .andExpect(jsonPath("$[?(@.eventType == 'TEST_RESULTS_RECORDED')].details", contains(
                        "JUnit: 3 of 3 passed, 0 failed. No artifact",
                        "JUnit: 7 of 10 passed, 3 failed. Artifact version 1",
                        "JUnit: 10 of 10 passed, 0 failed. Artifact version 1")))
                .andExpect(jsonPath("$[?(@.eventType == 'TEST_RESULTS_RECORDED')].developer",
                        everyItem(is("sam"))));
    }
}
