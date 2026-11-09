package verifai.presentation;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import verifai.domain.Approval;
import verifai.service.ApprovalService;
import verifai.service.TaskService;

/**
 * JSON API for approving, reopening, and the audit history (UC-14 to UC-16).
 * ApprovalService makes each change; TaskService reads the task back so the
 * response can show the approval count and the new status. Task decides every
 * rule; this class only formats the result.
 */
@RestController
@RequestMapping("/api/tasks/{id}")
public class ApprovalController {

    private final ApprovalService approvalService;
    private final TaskService taskService;

    public ApprovalController(ApprovalService approvalService, TaskService taskService) {
        this.approvalService = approvalService;
        this.taskService = taskService;
    }

    /** UC-14: records the developer's approval and returns progress such as "1 of 2". */
    @PostMapping("/approvals")
    public ApprovalResultResponse approve(@PathVariable("id") UUID id, @RequestBody DeveloperRequest request) {
        Approval approval = approvalService.approve(id, request.developer());
        return ApprovalResultResponse.from(approval, taskService.getTask(id));
    }

    /** UC-15: returns an APPROVED task to IN_PROGRESS with all checks PENDING and no approvals. */
    @PostMapping("/reopen")
    public TaskDetailsResponse reopen(@PathVariable("id") UUID id, @RequestBody ReopenRequest request) {
        approvalService.reopen(id, request.developer(), request.reason());
        return TaskDetailsResponse.from(taskService.getTask(id));
    }

    /** UC-16: every audit entry for the task, oldest first. */
    @GetMapping("/audit")
    public List<AuditEntryResponse> getAuditHistory(@PathVariable("id") UUID id) {
        return approvalService.getAuditHistory(id).stream().map(AuditEntryResponse::from).toList();
    }
}
