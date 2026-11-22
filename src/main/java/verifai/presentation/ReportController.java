package verifai.presentation;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import verifai.service.ReportService;
import verifai.service.VerificationReport;

/**
 * Downloads a task's verification report as a Markdown file (UC-18).
 * ReportService gathers the record and VerificationReportMarkdown formats it.
 * An unknown task is a 404 and an id that is not a UUID a 400, as JSON from
 * ApiExceptionHandler.
 */
@RestController
@RequestMapping("/api/tasks/{id}")
public class ReportController {

    static final MediaType MARKDOWN = new MediaType("text", "markdown", StandardCharsets.UTF_8);

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    /*
     * The content type is set on the response instead of with produces, so an
     * error is still written as JSON whatever Accept header the client sends.
     */
    @GetMapping("/report")
    public ResponseEntity<String> getReport(@PathVariable("id") UUID id) {
        VerificationReport report = reportService.getReport(id);
        ContentDisposition attachment = ContentDisposition.attachment()
                .filename(VerificationReportMarkdown.fileName(report))
                .build();
        return ResponseEntity.ok()
                .contentType(MARKDOWN)
                .header(HttpHeaders.CONTENT_DISPOSITION, attachment.toString())
                .body(VerificationReportMarkdown.render(report));
    }
}
