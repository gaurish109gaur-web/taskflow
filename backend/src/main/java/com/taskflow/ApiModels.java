package com.taskflow;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

public final class ApiModels {
    private ApiModels() {}

    public record Project(long id, String name, String description) {}
    public record Member(String username, String role) {}
    public record Task(long id, long projectId, String title, String description, String status,
                       String priority, String assignee, LocalDate dueDate,
                       LocalDateTime createdAt, LocalDateTime updatedAt) {}
    public record TaskInput(@NotBlank @Size(max = 180) String title,
                            @Size(max = 2000) String description,
                            String status, String priority, String assignee, LocalDate dueDate) {}
    public record TaskStatusInput(@NotBlank String status) {}
    public record Comment(long id, long taskId, String author, String body, LocalDateTime createdAt) {}
    public record CommentInput(@NotBlank @Size(max = 2000) String body) {}
    public record Activity(long id, String actor, String action, String detail, LocalDateTime createdAt) {}
    public record TaskEvent(String type, long projectId, Task task, String actor) {}
    public record User(String username) {}
    public record LoginInput(@Email @NotBlank String email, @NotBlank String password) {}
    public record SignupInput(@Email @NotBlank String email,
                              @NotBlank @Size(min = 8, max = 72) String password,
                              @Pattern(regexp = "MEMBER|VIEWER") String role) {}
    public record RegisterInput(@Email @NotBlank String email, @NotBlank @Size(min = 8, max = 72) String password,
                                @NotBlank String inviteToken) {}
    public record AuthToken(String token, String username, Instant expiresAt) {}
    public record InviteInput(@Email @NotBlank String email, @NotBlank String role) {}
    public record Invitation(String email, String role, String token, String inviteUrl, Instant expiresAt) {}
    public record InviteRegistration(String token, String username) {}
    public record ProjectSummary(long projectId, long total, long todo, long inProgress, long done,
                                 long overdue, long dueSoon) {}
}
