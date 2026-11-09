package verifai.presentation;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.startsWith;
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
import verifai.domain.VerificationType;
import verifai.service.ApprovalService;
import verifai.service.TaskService;

/**
 * Controller tests for approving, reopening, and the audit history. Where a
 * rule matters, the mocked service runs the real Domain method, so the status
 * code comes from the actual rule.
 */
@WebMvcTest(ApprovalController.class)
class ApprovalControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private ApprovalService approvalService;

    @MockitoBean
    private TaskService taskService;

    private Task startedTask() {
        Task task = new Task("Add login check", "Validate usernames", "alex");
        task.addRequirement("Blank usernames are rejected", "alex");
        task.addAcceptanceCriterion("Submitting a blank username shows an error", "alex");
        task.start("alex");
        task.recordArtifact("Write a login check", "Claude", "v1 code", "alex");
        return task;
    }

    private Task verifiedTask() {
        Task task = startedTask();
        for (VerificationType type : VerificationType.values()) {
            task.markCheckPassed(type, "Reviewed " + type, "dana");
        }
        return task;
    }

    private Task approvedTask() {
        Task task = verifiedTask();
        task.approve("alex");
        task.approve("dana");
        return task;
    }

    /** Lets the mocked services act on the real task, so Task applies the rules. */
    private void actOn(Task task) {
        when(taskService.getTask(task.getId())).thenReturn(task);
        when(approvalService.approve(eq(task.getId()), any()))
                .thenAnswer(inv -> task.approve(inv.getArgument(1)));
        when(approvalService.reopen(eq(task.getId()), any(), any()))
                .thenAnswer(inv -> task.reopen(inv.getArgument(1), inv.getArgument(2)));
        when(approvalService.getAuditHistory(task.getId())).thenAnswer(inv -> task.getAuditHistory());
    }

    private ResultActions approve(Task task, String developer) throws Exception {
        return mvc.perform(post("/api/tasks/" + task.getId() + "/approvals")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"developer\":\"" + developer + "\"}"));
    }

    private ResultActions reopen(Task task, String json) throws Exception {
        return mvc.perform(post("/api/tasks/" + task.getId() + "/reopen")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    // Approve (UC-14)

    @Test
    void firstApprovalLeavesTaskInProgressWithOneOfTwo() throws Exception {
        Task task = verifiedTask();
        actOn(task);

        approve(task, "alex")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approval.developer").value("alex"))
                .andExpect(jsonPath("$.approval.approvedAt").isNotEmpty())
                .andExpect(jsonPath("$.approvalCount").value(1))
                .andExpect(jsonPath("$.requiredApprovals").value(2))
                .andExpect(jsonPath("$.progress").value("1 of 2"))
                .andExpect(jsonPath("$.taskStatus").value("IN_PROGRESS"));
    }

    @Test
    void secondApprovalByAnotherDeveloperApprovesTheTask() throws Exception {
        Task task = verifiedTask();
        actOn(task);

        approve(task, "alex").andExpect(status().isOk());
        approve(task, "dana")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approval.developer").value("dana"))
                .andExpect(jsonPath("$.approvalCount").value(2))
                .andExpect(jsonPath("$.progress").value("2 of 2"))
                .andExpect(jsonPath("$.taskStatus").value("APPROVED"));
    }

    @Test
    void approvingWithACheckNotPassedReturns409() throws Exception {
        Task task = startedTask();
        task.markCheckPassed(VerificationType.REQUIREMENTS, "Matches", "dana");
        actOn(task);

        approve(task, "alex")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("All six checks must be PASSED before approval"));
    }

    @Test
    void secondApprovalBySameDeveloperReturns409() throws Exception {
        Task task = verifiedTask();
        actOn(task);

        approve(task, "dana").andExpect(status().isOk());
        approve(task, "Dana")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Dana has already approved this task"));
    }

    @Test
    void approvingWithoutDeveloperReturns400() throws Exception {
        Task task = verifiedTask();
        actOn(task);

        approve(task, " ")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Developer is required"));
    }

    @Test
    void approveWithoutBodyReturns400() throws Exception {
        mvc.perform(post("/api/tasks/" + UUID.randomUUID() + "/approvals"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(approvalService, taskService);
    }

    // Reopen (UC-15)

    @Test
    void reopenWithReasonReturnsTaskToInProgress() throws Exception {
        Task task = approvedTask();
        actOn(task);

        reopen(task, "{\"developer\":\"sam\",\"reason\":\"Found a missed edge case\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(task.getId().toString()))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.checks[*].status", everyItem(is("PENDING"))))
                .andExpect(jsonPath("$.approvals.length()").value(0))
                .andExpect(jsonPath("$.canApprove").value(false));
    }

    @Test
    void reopenWithoutReasonReturns400() throws Exception {
        Task task = approvedTask();
        actOn(task);

        reopen(task, "{\"developer\":\"sam\",\"reason\":\" \"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("A reason is required to reopen a task"));
        reopen(task, "{\"developer\":\"sam\"}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void reopeningATaskThatIsNotApprovedReturns409() throws Exception {
        Task task = verifiedTask();
        actOn(task);

        reopen(task, "{\"developer\":\"sam\",\"reason\":\"Found a missed edge case\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Only an APPROVED task can be reopened"));
    }

    // Audit history (UC-16)

    @Test
    void auditListsEntriesOldestFirstIncludingOldApprovalsAndReopenReason() throws Exception {
        Task task = approvedTask();
        task.reopen("sam", "Found a missed edge case");
        actOn(task);

        mvc.perform(get("/api/tasks/" + task.getId() + "/audit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].eventType").value("TASK_CREATED"))
                .andExpect(jsonPath("$[0].developer").value("alex"))
                .andExpect(jsonPath("$[0].details").value("Title: Add login check"))
                .andExpect(jsonPath("$[0].recordedAt").isNotEmpty())
                .andExpect(jsonPath("$[?(@.eventType == 'APPROVAL_RECORDED')].developer")
                        .value(contains("alex", "dana")))
                .andExpect(jsonPath("$[?(@.eventType == 'TASK_APPROVED')].details")
                        .value(contains("Approved by alex, dana")))
                .andExpect(jsonPath("$[-2].eventType").value("TASK_REOPENED"))
                .andExpect(jsonPath("$[-2].developer").value("sam"))
                .andExpect(jsonPath("$[-2].details",
                        startsWith("Reason: Found a missed edge case. Previous approvals: alex, dana")))
                .andExpect(jsonPath("$[-1].eventType").value("CHECKS_RESET"));
    }

    @Test
    void auditEntriesAreInTheOrderTheyWereRecorded() throws Exception {
        Task task = startedTask();
        actOn(task);

        mvc.perform(get("/api/tasks/" + task.getId() + "/audit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(task.getAuditHistory().size()))
                .andExpect(jsonPath("$[0].eventType").value("TASK_CREATED"))
                .andExpect(jsonPath("$[1].eventType").value("TASK_EDITED"))
                .andExpect(jsonPath("$[2].eventType").value("TASK_EDITED"))
                .andExpect(jsonPath("$[3].eventType").value("TASK_STARTED"))
                .andExpect(jsonPath("$[4].eventType").value("ARTIFACT_RECORDED"));
    }

    @Test
    void auditForUnknownTaskReturns404() throws Exception {
        UUID id = UUID.randomUUID();
        when(approvalService.getAuditHistory(id)).thenThrow(new NoSuchElementException("No task with id " + id));

        mvc.perform(get("/api/tasks/" + id + "/audit"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("No task with id " + id));
    }
}
