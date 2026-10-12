package verifai.presentation;

import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import verifai.domain.Task;
import verifai.domain.VerificationType;
import verifai.service.TaskService;

/**
 * Controller tests. Where a rule matters, the mocked service runs the real
 * Domain method, so the status code comes from the actual rule.
 */
@WebMvcTest(TaskController.class)
class TaskControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private TaskService taskService;

    private Task readyTask() {
        Task task = new Task("Add login check", "Validate usernames", "alex");
        task.addRequirement("Blank usernames are rejected", "alex");
        task.addAcceptanceCriterion("Submitting a blank username shows an error", "alex");
        return task;
    }

    private Task startedTask() {
        Task task = readyTask();
        task.start("alex");
        return task;
    }

    private Task verifiedTask() {
        Task task = startedTask();
        task.recordArtifact("Write a login check", "Claude", "v1 code", "alex");
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

    private ResultActions sendJson(MockHttpServletRequestBuilder request, String json) throws Exception {
        return mvc.perform(request.contentType(MediaType.APPLICATION_JSON).content(json));
    }

    // Create (UC-01)

    @Test
    void createReturns201WithLocationAndDetails() throws Exception {
        Task task = new Task("Add login check", "Validate usernames", "alex");
        when(taskService.createTask("Add login check", "Validate usernames", "alex")).thenReturn(task);

        sendJson(post("/api/tasks"),
                "{\"title\":\"Add login check\",\"description\":\"Validate usernames\",\"developer\":\"alex\"}")
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", endsWith("/api/tasks/" + task.getId())))
                .andExpect(jsonPath("$.id").value(task.getId().toString()))
                .andExpect(jsonPath("$.title").value("Add login check"))
                .andExpect(jsonPath("$.owner").value("alex"))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.checks.length()").value(6))
                .andExpect(jsonPath("$.requiredApprovals").value(2))
                .andExpect(jsonPath("$.editable").value(true))
                .andExpect(jsonPath("$.canStart").value(false))
                .andExpect(jsonPath("$.canApprove").value(false));
    }

    @Test
    void createWithBlankTitleReturns400Json() throws Exception {
        when(taskService.createTask(any(), any(), any()))
                .thenAnswer(inv -> new Task(inv.getArgument(0), inv.getArgument(1), inv.getArgument(2)));

        sendJson(post("/api/tasks"), "{\"title\":\" \",\"description\":\"\",\"developer\":\"alex\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Title is required"));
    }

    @Test
    void malformedJsonReturns400() throws Exception {
        sendJson(post("/api/tasks"), "{not json")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Request body is missing or is not valid JSON"));
        verifyNoInteractions(taskService);
    }

    // List and details (UC-05, UC-06)

    @Test
    void listReturnsSummaries() throws Exception {
        Task inProgress = startedTask();
        inProgress.recordArtifact("Write a login check", "Claude", "v1", "alex");
        inProgress.markCheckPassed(VerificationType.TESTING, "All tests pass", "dana");
        Task draft = new Task("Add logout button", "", "dana");
        when(taskService.listTasks()).thenReturn(List.of(inProgress, draft));

        mvc.perform(get("/api/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(inProgress.getId().toString()))
                .andExpect(jsonPath("$[0].title").value("Add login check"))
                .andExpect(jsonPath("$[0].owner").value("alex"))
                .andExpect(jsonPath("$[0].status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$[0].passedChecks").value(1))
                .andExpect(jsonPath("$[0].totalChecks").value(6))
                .andExpect(jsonPath("$[0].approvalCount").value(0))
                .andExpect(jsonPath("$[0].requiredApprovals").value(2))
                .andExpect(jsonPath("$[1].status").value("DRAFT"))
                .andExpect(jsonPath("$[1].passedChecks").value(0));
    }

    @Test
    void listIsEmptyArrayWhenThereAreNoTasks() throws Exception {
        when(taskService.listTasks()).thenReturn(List.of());

        mvc.perform(get("/api/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void getReturnsFullDetails() throws Exception {
        Task task = verifiedTask();
        task.approve("dana");
        when(taskService.getTask(task.getId())).thenReturn(task);

        mvc.perform(get("/api/tasks/" + task.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Validate usernames"))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.requirements[0]").value("Blank usernames are rejected"))
                .andExpect(jsonPath("$.acceptanceCriteria[0]").value("Submitting a blank username shows an error"))
                .andExpect(jsonPath("$.checks[0].type").value("REQUIREMENTS"))
                .andExpect(jsonPath("$.checks[0].status").value("PASSED"))
                .andExpect(jsonPath("$.checks[0].evidence").value("Reviewed REQUIREMENTS"))
                .andExpect(jsonPath("$.checks[0].reviewer").value("dana"))
                .andExpect(jsonPath("$.checks[5].type").value("SECURITY"))
                .andExpect(jsonPath("$.artifactCount").value(1))
                .andExpect(jsonPath("$.approvals.length()").value(1))
                .andExpect(jsonPath("$.approvals[0].developer").value("dana"))
                .andExpect(jsonPath("$.editable").value(true))
                .andExpect(jsonPath("$.canStart").value(false))
                .andExpect(jsonPath("$.canApprove").value(true));
    }

    @Test
    void responseDoesNotExposeDomainOnlyFields() throws Exception {
        Task task = startedTask();
        when(taskService.getTask(task.getId())).thenReturn(task);

        mvc.perform(get("/api/tasks/" + task.getId()))
                .andExpect(jsonPath("$.auditHistory").doesNotExist())
                .andExpect(jsonPath("$.verifications").doesNotExist())
                .andExpect(jsonPath("$.artifacts").doesNotExist());
    }

    @Test
    void unknownTaskReturns404Json() throws Exception {
        UUID id = UUID.randomUUID();
        when(taskService.getTask(id)).thenThrow(new NoSuchElementException("No task with id " + id));

        mvc.perform(get("/api/tasks/" + id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("No task with id " + id));
    }

    @Test
    void invalidTaskIdReturns400() throws Exception {
        mvc.perform(get("/api/tasks/not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
        verifyNoInteractions(taskService);
    }

    @Test
    void oldHtmlPageIsGone() throws Exception {
        mvc.perform(get("/tasks"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    // Edit (UC-03)

    @Test
    void editReturnsUpdatedDetails() throws Exception {
        Task task = readyTask();
        when(taskService.editDetails(task.getId(), "Add login validation", "Trim first", "dana"))
                .thenAnswer(inv -> {
                    task.editDetails("Add login validation", "Trim first", "dana");
                    return task;
                });

        sendJson(patch("/api/tasks/" + task.getId()),
                "{\"title\":\"Add login validation\",\"description\":\"Trim first\",\"developer\":\"dana\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Add login validation"))
                .andExpect(jsonPath("$.description").value("Trim first"));
    }

    @Test
    void editingAnApprovedTaskReturns409Json() throws Exception {
        Task task = approvedTask();
        when(taskService.editDetails(eq(task.getId()), any(), any(), any())).thenAnswer(inv -> {
            task.editDetails(inv.getArgument(1), inv.getArgument(2), inv.getArgument(3));
            return task;
        });

        sendJson(patch("/api/tasks/" + task.getId()),
                "{\"title\":\"New title\",\"description\":\"\",\"developer\":\"dana\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message").value("Only a DRAFT or IN_PROGRESS task can be edited"));
    }

    // Requirements and acceptance criteria (UC-02, UC-03)

    @Test
    void addRequirementReturnsDetails() throws Exception {
        Task task = new Task("Add login check", "", "alex");
        when(taskService.addRequirement(task.getId(), "Trim usernames", "alex")).thenAnswer(inv -> {
            task.addRequirement("Trim usernames", "alex");
            return task;
        });

        sendJson(post("/api/tasks/" + task.getId() + "/requirements"),
                "{\"text\":\"Trim usernames\",\"developer\":\"alex\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requirements[0]").value("Trim usernames"));
    }

    @Test
    void addAcceptanceCriterionReturnsDetails() throws Exception {
        Task task = new Task("Add login check", "", "alex");
        when(taskService.addAcceptanceCriterion(task.getId(), "Blank shows an error", "alex")).thenAnswer(inv -> {
            task.addAcceptanceCriterion("Blank shows an error", "alex");
            return task;
        });

        sendJson(post("/api/tasks/" + task.getId() + "/acceptance-criteria"),
                "{\"text\":\"Blank shows an error\",\"developer\":\"alex\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.acceptanceCriteria[0]").value("Blank shows an error"));
    }

    @Test
    void removingARequirementFromAnInProgressTaskResetsChecksAndClearsApprovals() throws Exception {
        Task task = verifiedTask();
        task.addRequirement("Usernames are trimmed", "alex");
        for (VerificationType type : VerificationType.values()) {
            task.markCheckPassed(type, "Reviewed again", "dana");
        }
        task.approve("dana");
        when(taskService.removeRequirement(task.getId(), 1, "alex")).thenAnswer(inv -> {
            task.removeRequirement(1, "alex");
            return task;
        });

        mvc.perform(delete("/api/tasks/" + task.getId() + "/requirements/1").param("developer", "alex"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requirements.length()").value(1))
                .andExpect(jsonPath("$.checks[*].status", everyItem(is("PENDING"))))
                .andExpect(jsonPath("$.approvals.length()").value(0))
                .andExpect(jsonPath("$.canApprove").value(false));
    }

    @Test
    void removeAcceptanceCriterionPassesIndexAndDeveloper() throws Exception {
        Task task = readyTask();
        when(taskService.removeAcceptanceCriterion(task.getId(), 0, "dana")).thenAnswer(inv -> {
            task.removeAcceptanceCriterion(0, "dana");
            return task;
        });

        mvc.perform(delete("/api/tasks/" + task.getId() + "/acceptance-criteria/0").param("developer", "dana"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.acceptanceCriteria.length()").value(0));
        verify(taskService).removeAcceptanceCriterion(task.getId(), 0, "dana");
    }

    @Test
    void removingTheLastRequirementOfAnInProgressTaskReturns409() throws Exception {
        Task task = startedTask();
        when(taskService.removeRequirement(eq(task.getId()), anyInt(), any())).thenAnswer(inv -> {
            task.removeRequirement(inv.getArgument(1), inv.getArgument(2));
            return task;
        });

        mvc.perform(delete("/api/tasks/" + task.getId() + "/requirements/0").param("developer", "alex"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("An IN_PROGRESS task needs at least one requirement"));
    }

    @Test
    void removeWithoutDeveloperOrWithBadIndexReturns400() throws Exception {
        Task task = readyTask();
        when(taskService.removeRequirement(eq(task.getId()), anyInt(), any())).thenAnswer(inv -> {
            task.removeRequirement(inv.getArgument(1), inv.getArgument(2));
            return task;
        });

        mvc.perform(delete("/api/tasks/" + task.getId() + "/requirements/0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Developer is required"));
        mvc.perform(delete("/api/tasks/" + task.getId() + "/requirements/3").param("developer", "alex"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("No requirement at position 3"));
        mvc.perform(delete("/api/tasks/" + task.getId() + "/requirements/first").param("developer", "alex"))
                .andExpect(status().isBadRequest());
    }

    // Start (UC-04)

    @Test
    void startReturnsInProgressDetails() throws Exception {
        Task task = readyTask();
        when(taskService.startTask(task.getId(), "alex")).thenAnswer(inv -> {
            task.start("alex");
            return task;
        });

        sendJson(post("/api/tasks/" + task.getId() + "/start"), "{\"developer\":\"alex\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.canStart").value(false));
    }

    @Test
    void startingWithoutRequirementAndCriterionReturns409() throws Exception {
        Task task = new Task("Add login check", "", "alex");
        when(taskService.startTask(eq(task.getId()), any())).thenAnswer(inv -> {
            task.start(inv.getArgument(1));
            return task;
        });

        sendJson(post("/api/tasks/" + task.getId() + "/start"), "{\"developer\":\"alex\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("At least one requirement is needed to start a task"));
    }

    @Test
    void startWithoutBodyReturns400() throws Exception {
        mvc.perform(post("/api/tasks/" + UUID.randomUUID() + "/start"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(taskService);
    }
}
