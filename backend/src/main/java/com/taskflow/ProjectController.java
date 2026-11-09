package com.taskflow;

import com.taskflow.ApiModels.Activity;
import com.taskflow.ApiModels.Comment;
import com.taskflow.ApiModels.CommentInput;
import com.taskflow.ApiModels.Member;
import com.taskflow.ApiModels.Project;
import com.taskflow.ApiModels.ProjectSummary;
import com.taskflow.ApiModels.InviteInput;
import com.taskflow.ApiModels.Invitation;
import com.taskflow.ApiModels.Task;
import com.taskflow.ApiModels.TaskEvent;
import com.taskflow.ApiModels.TaskInput;
import com.taskflow.ApiModels.TaskStatusInput;
import com.taskflow.ApiModels.User;
import jakarta.validation.Valid;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ProjectController {
    private final ProjectService projects;
    private final SimpMessagingTemplate messaging;
    private final InvitationService invitations;

    public ProjectController(ProjectService projects, SimpMessagingTemplate messaging,
                             InvitationService invitations) {
        this.projects = projects;
        this.messaging = messaging;
        this.invitations = invitations;
    }

    @GetMapping("/me")
    public User me(Authentication authentication) {
        return new User(authentication.getName());
    }

    @GetMapping("/projects")
    public List<Project> projects(Authentication authentication) {
        return projects.projectsFor(authentication.getName());
    }

    @GetMapping("/projects/{projectId}/tasks")
    public List<Task> tasks(@PathVariable long projectId, Authentication authentication) {
        return projects.tasks(projectId, authentication.getName());
    }

    @GetMapping("/projects/{projectId}/summary")
    public ProjectSummary summary(@PathVariable long projectId, Authentication authentication) {
        return projects.summary(projectId, authentication.getName());
    }

    @PostMapping("/projects/{projectId}/invitations")
    public Invitation invite(@PathVariable long projectId, @Valid @RequestBody InviteInput input,
                             Authentication authentication) {
        Invitation invitation = invitations.create(projectId, input.email(), input.role(), authentication.getName());
        publish(projectId, new TaskEvent("INVITATION_CREATED", projectId, null, authentication.getName()));
        return invitation;
    }

    @PostMapping("/projects/{projectId}/tasks")
    public Task createTask(@PathVariable long projectId, @Valid @RequestBody TaskInput input,
                           Authentication authentication) {
        Task task = projects.createTask(projectId, input, authentication.getName());
        publish(projectId, new TaskEvent("TASK_CREATED", projectId, task, authentication.getName()));
        return task;
    }

    @PutMapping("/tasks/{taskId}")
    public Task updateTask(@PathVariable long taskId, @Valid @RequestBody TaskInput input,
                           Authentication authentication) {
        Task task = projects.updateTask(taskId, input, authentication.getName());
        publish(task.projectId(), new TaskEvent("TASK_UPDATED", task.projectId(), task,
                authentication.getName()));
        return task;
    }

    @PatchMapping("/tasks/{taskId}/status")
    public Task updateStatus(@PathVariable long taskId, @Valid @RequestBody TaskStatusInput input,
                             Authentication authentication) {
        Task task = projects.updateStatus(taskId, input.status(), authentication.getName());
        publish(task.projectId(), new TaskEvent("TASK_UPDATED", task.projectId(), task,
                authentication.getName()));
        return task;
    }

    @GetMapping("/projects/{projectId}/members")
    public List<Member> members(@PathVariable long projectId, Authentication authentication) {
        return projects.members(projectId, authentication.getName());
    }

    @GetMapping("/projects/{projectId}/activity")
    public List<Activity> activity(@PathVariable long projectId, Authentication authentication) {
        return projects.activity(projectId, authentication.getName());
    }

    @GetMapping("/tasks/{taskId}/comments")
    public List<Comment> comments(@PathVariable long taskId, Authentication authentication) {
        return projects.comments(taskId, authentication.getName());
    }

    @PostMapping("/tasks/{taskId}/comments")
    public Comment addComment(@PathVariable long taskId, @Valid @RequestBody CommentInput input,
                              Authentication authentication) {
        Comment comment = projects.addComment(taskId, input.body(), authentication.getName());
        Task task = projects.task(comment.taskId(), authentication.getName());
        publish(task.projectId(), new TaskEvent("COMMENT_ADDED", task.projectId(), task,
                authentication.getName()));
        return comment;
    }

    private void publish(long projectId, TaskEvent event) {
        messaging.convertAndSend("/topic/projects/" + projectId, event);
    }
}
