package verifai.presentation;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.NoSuchElementException;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import verifai.data.InMemoryTaskRepository;
import verifai.data.TaskRepository;
import verifai.domain.Task;
import verifai.service.ReportService;
import verifai.service.VerificationReport;

/** Controller tests for downloading a task's verification report as Markdown. */
@WebMvcTest(ReportController.class)
class ReportControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private ReportService reportService;

    /** A real report of the task, made the way ReportService makes it. */
    private static VerificationReport reportOf(Task task) {
        TaskRepository repository = new InMemoryTaskRepository();
        repository.save(task);
        Clock clock = Clock.fixed(Instant.parse("2026-11-22T14:03:27Z"), ZoneOffset.UTC);
        return new ReportService(repository, clock).getReport(task.getId());
    }

    @Test
    void theReportIsAMarkdownAttachmentNamedAfterTheTask() throws Exception {
        Task task = new Task("Add login check", "Validate usernames", "alex");
        when(reportService.getReport(task.getId())).thenReturn(reportOf(task));

        mvc.perform(get("/api/tasks/{id}/report", task.getId()))
                .andExpect(status().isOk())
                .andExpect(content().contentType("text/markdown;charset=UTF-8"))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"verifai-report-add-login-check-2026-11-22.md\""))
                .andExpect(content().string(startsWith("# Verification report: Add login check\n")));
    }

    @Test
    void aTaskWithNoArtifactsStillGetsAFullReport() throws Exception {
        Task task = new Task("Add login check", "", "alex");
        when(reportService.getReport(task.getId())).thenReturn(reportOf(task));

        mvc.perform(get("/api/tasks/{id}/report", task.getId()))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("## Artifact versions\n\n_No artifacts recorded._")))
                .andExpect(content().string(containsString("## Audit history")));
    }

    @Test
    void textOutsideAsciiIsSentAsUtf8() throws Exception {
        Task task = new Task("Café — résumé check", "", "zoë");
        when(reportService.getReport(task.getId())).thenReturn(reportOf(task));

        mvc.perform(get("/api/tasks/{id}/report", task.getId()))
                .andExpect(content().encoding("UTF-8"))
                .andExpect(content().string(containsString("# Verification report: Café — résumé check")))
                .andExpect(content().string(containsString("- **Owner:** zoë")))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"verifai-report-cafe-resume-check-2026-11-22.md\""));
    }

    @Test
    void anUnknownTaskReturns404Json() throws Exception {
        UUID unknown = UUID.randomUUID();
        when(reportService.getReport(unknown)).thenThrow(new NoSuchElementException("No task with id " + unknown));

        mvc.perform(get("/api/tasks/{id}/report", unknown)
                        .accept(MediaType.parseMediaType("text/markdown"), MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("No task with id " + unknown));
    }

    @Test
    void anIdThatIsNotAUuidReturns400WithoutAskingTheService() throws Exception {
        mvc.perform(get("/api/tasks/{id}/report", "not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(reportService);
    }
}
