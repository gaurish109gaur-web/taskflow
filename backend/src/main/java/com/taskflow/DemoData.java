package com.taskflow;

import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
public class DemoData implements CommandLineRunner {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final String adminPassword;
    private final String memberPassword;
    private final String viewerPassword;

    public DemoData(JdbcTemplate jdbc, PasswordEncoder passwordEncoder,
                    @Value("${taskflow.admin-password}") String adminPassword,
                    @Value("${taskflow.member-password}") String memberPassword,
                    @Value("${taskflow.viewer-password}") String viewerPassword) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.adminPassword = adminPassword;
        this.memberPassword = memberPassword;
        this.viewerPassword = viewerPassword;
    }

    @Override
    public void run(String... args) {
        seedUser("admin@taskflow.local", adminPassword);
        seedUser("member@taskflow.local", memberPassword);
        seedUser("viewer@taskflow.local", viewerPassword);
        Integer projects = jdbc.queryForObject("SELECT COUNT(*) FROM projects", Integer.class);
        if (projects != null && projects > 0) {
            return;
        }
        jdbc.update("INSERT INTO projects (name, description) VALUES (?, ?)",
                "Atlas launch", "Coordinate the release of the next Atlas platform milestone.");
        jdbc.update("INSERT INTO project_members (project_id, username, role) VALUES (1, ?, 'ADMIN')",
                "admin@taskflow.local");
        jdbc.update("INSERT INTO project_members (project_id, username, role) VALUES (1, ?, 'MEMBER')",
                "member@taskflow.local");
        jdbc.update("INSERT INTO project_members (project_id, username, role) VALUES (1, ?, 'VIEWER')",
                "viewer@taskflow.local");
        seedTask("Finalize release checklist", "Confirm owners, dependencies, and go-live checks.",
                "IN_PROGRESS", "HIGH", "admin@taskflow.local", LocalDate.now().plusDays(2));
        seedTask("Review onboarding flow", "Collect feedback from the support and design teams.",
                "TODO", "MEDIUM", "member@taskflow.local", LocalDate.now().plusDays(5));
        seedTask("Publish API changelog", "Document the latest endpoint and response changes.",
                "DONE", "LOW", "admin@taskflow.local", LocalDate.now().minusDays(1));
        jdbc.update("""
                INSERT INTO activity_entries (project_id, actor, action, detail)
                VALUES (1, ?, 'created_project', 'Atlas launch project is ready')
                """, "admin@taskflow.local");
    }

    private void seedTask(String title, String description, String status, String priority,
                          String assignee, LocalDate dueDate) {
        jdbc.update("""
                INSERT INTO work_items (project_id, title, description, status, priority, assignee, due_date)
                VALUES (1, ?, ?, ?, ?, ?, ?)
                """, title, description, status, priority, assignee, java.sql.Date.valueOf(dueDate));
    }
}

private void seedUser(String username, String password) {
    List<String> users = jdbc.query("SELECT username FROM user_accounts WHERE username = ?",
            (rs, row) -> rs.getString("username"), username);
    if (users.isEmpty()) {
        jdbc.update("INSERT INTO user_accounts (username, password_hash) VALUES (?, ?)",
                username, passwordEncoder.encode(password));
    }
}
