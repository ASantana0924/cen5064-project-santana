package verifai;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;
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
}
