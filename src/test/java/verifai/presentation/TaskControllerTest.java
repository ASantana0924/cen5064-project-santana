package verifai.presentation;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import verifai.domain.Task;
import verifai.service.TaskService;

@WebMvcTest(TaskController.class)
class TaskControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private TaskService taskService;

    @Test
    void listShowsTitleOwnerAndStatusOfEachTask() throws Exception {
        Task first = new Task("Add login check", "Validate usernames", "ASantana0924");
        Task second = new Task("Add logout button", "", "dquin144");
        first.addRequirement("Blank usernames are rejected", "ASantana0924");
        first.addAcceptanceCriterion("Submitting a blank username shows an error", "ASantana0924");
        first.start("ASantana0924");
        when(taskService.listTasks()).thenReturn(List.of(first, second));

        mvc.perform(get("/tasks"))
                .andExpect(status().isOk())
                .andExpect(view().name("tasks"))
                .andExpect(content().string(containsString("Add login check")))
                .andExpect(content().string(containsString("ASantana0924")))
                .andExpect(content().string(containsString("IN_PROGRESS")))
                .andExpect(content().string(containsString("Add logout button")))
                .andExpect(content().string(containsString("dquin144")))
                .andExpect(content().string(containsString("DRAFT")))
                .andExpect(content().string(not(containsString("No tasks yet."))));
    }

    @Test
    void listShowsMessageWhenThereAreNoTasks() throws Exception {
        when(taskService.listTasks()).thenReturn(List.of());

        mvc.perform(get("/tasks"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("No tasks yet.")))
                .andExpect(content().string(not(containsString("<table"))));
    }

    @Test
    void listEscapesHtmlInTaskTitles() throws Exception {
        Task task = new Task("<script>alert('x')</script>", "", "ASantana0924");
        when(taskService.listTasks()).thenReturn(List.of(task));

        mvc.perform(get("/tasks"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("&lt;script&gt;")))
                .andExpect(content().string(not(containsString("<script>"))));
    }
}
