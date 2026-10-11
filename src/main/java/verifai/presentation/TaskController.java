package verifai.presentation;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import verifai.service.TaskService;

/**
 * Serves the task pages. Reads and changes tasks only through TaskService,
 * never through the Data tier.
 */
@Controller
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    /** UC-05: shows every task with its title, owner, and status, oldest first. */
    @GetMapping("/tasks")
    public String listTasks(Model model) {
        model.addAttribute("tasks", taskService.listTasks());
        return "tasks";
    }
}
