package com.taskflow;

import com.taskflow.ApiModels.Activity;
import com.taskflow.ApiModels.Comment;
import com.taskflow.ApiModels.Member;
import com.taskflow.ApiModels.Project;
import com.taskflow.ApiModels.ProjectSummary;
import com.taskflow.ApiModels.Task;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ProjectService {
    private final JdbcTemplate jdbc;

    public ProjectService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Project> projectsFor(String username) {
        return jdbc.query("""
                SELECT p.id, p.name, p.description FROM projects p
                JOIN project_members m ON m.project_id = p.id WHERE m.username = ? ORDER BY p.id
                """, (rs, row) -> new Project(rs.getLong("id"), rs.getString("name"),
                rs.getString("description")), username);
    }

    public List<Task> tasks(long projectId, String username) {
        requireRole(projectId, username, "VIEWER");
        return jdbc.query("""
                SELECT * FROM work_items WHERE project_id = ? ORDER BY
                CASE status WHEN 'IN_PROGRESS' THEN 0 WHEN 'TODO' THEN 1 ELSE 2 END, due_date, id
                """, this::mapTask, projectId);
    }

    public List<Member> members(long projectId, String username) {
        requireRole(projectId, username, "VIEWER");
        return jdbc.query("SELECT username, role FROM project_members WHERE project_id = ? ORDER BY username",
                (rs, row) -> new Member(rs.getString("username"), rs.getString("role")), projectId);
    }

    public List<Activity> activity(long projectId, String username) {
        requireRole(projectId, username, "VIEWER");
        return jdbc.query("""
                SELECT id, actor, action, detail, created_at FROM activity_entries
                WHERE project_id = ? ORDER BY created_at DESC, id DESC LIMIT 30
                """, (rs, row) -> new Activity(rs.getLong("id"), rs.getString("actor"),
                rs.getString("action"), rs.getString("detail"), toLocalDateTime(rs.getTimestamp("created_at"))),
                projectId);
    }

    public ProjectSummary summary(long projectId, String username) {
        requireRole(projectId, username, "VIEWER");
        List<Task> tasks = jdbc.query("SELECT * FROM work_items WHERE project_id = ?",
                this::mapTask, projectId);
        LocalDate today = LocalDate.now();
        long todo = tasks.stream().filter(task -> task.status().equals("TODO")).count();
        long inProgress = tasks.stream().filter(task -> task.status().equals("IN_PROGRESS")).count();
        long done = tasks.stream().filter(task -> task.status().equals("DONE")).count();
        long overdue = tasks.stream().filter(task -> !task.status().equals("DONE")
                && task.dueDate() != null && task.dueDate().isBefore(today)).count();
        long dueSoon = tasks.stream().filter(task -> !task.status().equals("DONE")
                && task.dueDate() != null && !task.dueDate().isBefore(today)
                && !task.dueDate().isAfter(today.plusDays(7))).count();
        return new ProjectSummary(projectId, tasks.size(), todo, inProgress, done, overdue, dueSoon);
    }

    public List<Comment> comments(long taskId, String username) {
        long projectId = projectIdForTask(taskId);
        requireRole(projectId, username, "VIEWER");
        return jdbc.query("""
                SELECT id, task_id, author, body, created_at FROM comments
                WHERE task_id = ? ORDER BY created_at, id
                """, (rs, row) -> new Comment(rs.getLong("id"), rs.getLong("task_id"),
                rs.getString("author"), rs.getString("body"), toLocalDateTime(rs.getTimestamp("created_at"))),
                taskId);
    }

    public Task task(long taskId, String username) {
        requireRole(projectIdForTask(taskId), username, "VIEWER");
        return taskForId(taskId);
    }

    @Transactional
    public Task createTask(long projectId, ApiModels.TaskInput input, String actor) {
        requireRole(projectId, actor, "MEMBER");
        String status = valueOr(input.status(), "TODO").toUpperCase();
        String priority = valueOr(input.priority(), "MEDIUM").toUpperCase();
        validateStatus(status);
        validatePriority(priority);
        validateAssignee(projectId, input.assignee());
        String assignee = input.assignee() == null || input.assignee().isBlank() ? null : input.assignee();
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update((PreparedStatementCreator) connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO work_items (project_id, title, description, status, priority, assignee, due_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, projectId);
            statement.setString(2, input.title().trim());
            statement.setString(3, valueOr(input.description(), ""));
            statement.setString(4, status);
            statement.setString(5, priority);
            statement.setString(6, assignee);
            if (input.dueDate() == null) {
                statement.setNull(7, java.sql.Types.DATE);
            } else {
                statement.setDate(7, Date.valueOf(input.dueDate()));
            }
            return statement;
        }, keyHolder);
        Task task = taskForId(keyHolder.getKey().longValue());
        recordActivity(projectId, actor, "created_task", "Created \"" + task.title() + "\"");
        return task;
    }

    @Transactional
    public Task updateTask(long taskId, ApiModels.TaskInput input, String actor) {
        long projectId = projectIdForTask(taskId);
        requireRole(projectId, actor, "MEMBER");
        String status = valueOr(input.status(), "TODO").toUpperCase();
        String priority = valueOr(input.priority(), "MEDIUM").toUpperCase();
        validateStatus(status);
        validatePriority(priority);
        validateAssignee(projectId, input.assignee());
        String assignee = input.assignee() == null || input.assignee().isBlank() ? null : input.assignee();
        Task previous = taskForId(taskId);
        jdbc.update("""
                UPDATE work_items SET title = ?, description = ?, status = ?, priority = ?,
                assignee = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
                """, input.title().trim(), valueOr(input.description(), ""), status, priority,
                assignee, input.dueDate() == null ? null : Date.valueOf(input.dueDate()), taskId);
        Task updated = taskForId(taskId);
        recordActivity(projectId, actor, "updated_task", "Updated \"" + updated.title() + "\"");
        return updated;
    }

    @Transactional
    public Task updateStatus(long taskId, String status, String actor) {
        long projectId = projectIdForTask(taskId);
        requireRole(projectId, actor, "MEMBER");
        status = status.toUpperCase();
        validateStatus(status);
        Task oldTask = taskForId(taskId);
        jdbc.update("UPDATE work_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                status, taskId);
        Task updated = taskForId(taskId);
        recordActivity(projectId, actor, "changed_status",
                oldTask.title() + " moved to " + status.replace('_', ' ').toLowerCase());
        return updated;
    }

    @Transactional
    public Comment addComment(long taskId, String body, String actor) {
        long projectId = projectIdForTask(taskId);
        requireRole(projectId, actor, "MEMBER");
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update((PreparedStatementCreator) connection -> {
            var statement = connection.prepareStatement(
                    "INSERT INTO comments (task_id, author, body) VALUES (?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, taskId);
            statement.setString(2, actor);
            statement.setString(3, body.trim());
            return statement;
        }, keyHolder);
        Comment comment = jdbc.query("""
                SELECT id, task_id, author, body, created_at FROM comments WHERE id = ?
                """, (rs, row) -> new Comment(rs.getLong("id"), rs.getLong("task_id"),
                rs.getString("author"), rs.getString("body"), toLocalDateTime(rs.getTimestamp("created_at"))),
                keyHolder.getKey().longValue()).get(0);
        recordActivity(projectId, actor, "commented", "Commented on \"" + taskForId(taskId).title() + "\"");
        return comment;
    }

    public boolean isProjectMember(long projectId, String username) {
        return !jdbc.query("SELECT username FROM project_members WHERE project_id = ? AND username = ?",
                (rs, row) -> rs.getString("username"), projectId, username).isEmpty();
    }

    public void requireRole(long projectId, String username, String minimumRole) {
        List<String> roles = jdbc.query("SELECT role FROM project_members WHERE project_id = ? AND username = ?",
                (rs, row) -> rs.getString("role"), projectId, username);
        if (roles.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not a member of this project");
        }
        int actual = roleRank(roles.get(0));
        if (actual < roleRank(minimumRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your project role cannot perform this action");
        }
    }

    private int roleRank(String role) {
        return switch (role) {
            case "ADMIN" -> 3;
            case "MEMBER" -> 2;
            case "VIEWER" -> 1;
            default -> 0;
        };
    }

    private void validateAssignee(long projectId, String assignee) {
        if (assignee != null && !assignee.isBlank() && !isProjectMember(projectId, assignee)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assignee must be a project member");
        }
    }

    private void validateStatus(String status) {
        if (!List.of("TODO", "IN_PROGRESS", "DONE").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported task status");
        }
    }

    private void validatePriority(String priority) {
        if (!List.of("LOW", "MEDIUM", "HIGH").contains(priority)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported task priority");
        }
    }

    private void recordActivity(long projectId, String actor, String action, String detail) {
        jdbc.update("INSERT INTO activity_entries (project_id, actor, action, detail) VALUES (?, ?, ?, ?)",
                projectId, actor, action, detail);
    }

    private long projectIdForTask(long taskId) {
        List<Long> ids = jdbc.query("SELECT project_id FROM work_items WHERE id = ?",
                (rs, row) -> rs.getLong("project_id"), taskId);
        if (ids.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found");
        }
        return ids.get(0);
    }

    private Task taskForId(long taskId) {
        return jdbc.query("SELECT * FROM work_items WHERE id = ?", this::mapTask, taskId)
                .stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    }

    private Task mapTask(ResultSet rs, int row) throws SQLException {
        Date dueDate = rs.getDate("due_date");
        return new Task(rs.getLong("id"), rs.getLong("project_id"), rs.getString("title"),
                rs.getString("description"), rs.getString("status"), rs.getString("priority"),
                rs.getString("assignee"), dueDate == null ? null : dueDate.toLocalDate(),
                toLocalDateTime(rs.getTimestamp("created_at")),
                toLocalDateTime(rs.getTimestamp("updated_at")));
    }

    private static LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private static String valueOr(String value, String fallback) {
        return value == null ? fallback : value;
    }
}
