package verifai.presentation;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import verifai.domain.Task;
import verifai.service.TaskService;

/**
 * JSON API for tasks (UC-01 to UC-06). Reads and changes tasks only through
 * TaskService and returns DTOs, never Domain objects. Errors are turned into
 * JSON by ApiExceptionHandler.
 */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    /** UC-01: creates a DRAFT task owned by the acting developer. */
    @PostMapping
    public ResponseEntity<TaskDetailsResponse> createTask(@RequestBody CreateTaskRequest request) {
        Task task = taskService.createTask(request.title(), request.description(), request.developer());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(task.getId())
                .toUri();
        return ResponseEntity.created(location).body(TaskDetailsResponse.from(task));
    }

    /** UC-05: lists every task, oldest first. */
    @GetMapping
    public List<TaskSummaryResponse> listTasks() {
        return taskService.listTasks().stream().map(TaskSummaryResponse::from).toList();
    }

    /** UC-06: shows one task in full. */
    @GetMapping("/{id}")
    public TaskDetailsResponse getTask(@PathVariable("id") UUID id) {
        return TaskDetailsResponse.from(taskService.getTask(id));
    }

    /** UC-03: changes the title and description. */
    @PatchMapping("/{id}")
    public TaskDetailsResponse editTask(@PathVariable("id") UUID id, @RequestBody EditTaskRequest request) {
        return TaskDetailsResponse.from(
                taskService.editDetails(id, request.title(), request.description(), request.developer()));
    }

    /** UC-03: adds a requirement. */
    @PostMapping("/{id}/requirements")
    public TaskDetailsResponse addRequirement(@PathVariable("id") UUID id, @RequestBody TextItemRequest request) {
        return TaskDetailsResponse.from(taskService.addRequirement(id, request.text(), request.developer()));
    }

    /** UC-03: removes the requirement at the 0-based index. */
    @DeleteMapping("/{id}/requirements/{index}")
    public TaskDetailsResponse removeRequirement(@PathVariable("id") UUID id, @PathVariable("index") int index,
            @RequestParam(name = "developer", required = false) String developer) {
        return TaskDetailsResponse.from(taskService.removeRequirement(id, index, developer));
    }

    /** UC-02: adds an acceptance criterion. */
    @PostMapping("/{id}/acceptance-criteria")
    public TaskDetailsResponse addAcceptanceCriterion(@PathVariable("id") UUID id,
            @RequestBody TextItemRequest request) {
        return TaskDetailsResponse.from(
                taskService.addAcceptanceCriterion(id, request.text(), request.developer()));
    }

    /** UC-02: removes the acceptance criterion at the 0-based index. */
    @DeleteMapping("/{id}/acceptance-criteria/{index}")
    public TaskDetailsResponse removeAcceptanceCriterion(@PathVariable("id") UUID id,
            @PathVariable("index") int index,
            @RequestParam(name = "developer", required = false) String developer) {
        return TaskDetailsResponse.from(taskService.removeAcceptanceCriterion(id, index, developer));
    }

    /** UC-04: moves a DRAFT task to IN_PROGRESS. */
    @PostMapping("/{id}/start")
    public TaskDetailsResponse startTask(@PathVariable("id") UUID id, @RequestBody DeveloperRequest request) {
        return TaskDetailsResponse.from(taskService.startTask(id, request.developer()));
    }
}
