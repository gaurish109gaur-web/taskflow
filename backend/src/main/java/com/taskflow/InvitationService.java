package com.taskflow;

import com.taskflow.ApiModels.Invitation;
import com.taskflow.ApiModels.InviteRegistration;
import com.taskflow.ApiModels.RegisterInput;
import com.taskflow.ApiModels.SignupInput;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.HexFormat;

@Service
public class InvitationService {
    private final JdbcTemplate jdbc;
    private final ProjectService projects;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final SecureRandom secureRandom = new SecureRandom();
    private final String appUrl;

    public InvitationService(JdbcTemplate jdbc, ProjectService projects, PasswordEncoder passwordEncoder,
                             JwtService jwtService,
                             @Value("${taskflow.app-url:http://localhost:5173}") String appUrl) {
        this.jdbc = jdbc;
        this.projects = projects;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.appUrl = appUrl.replaceAll("/+$", "");
    }

    @Transactional
    public Invitation create(long projectId, String email, String role, String actor) {
        projects.requireRole(projectId, actor, "ADMIN");
        String normalizedEmail = email.trim().toLowerCase();
        String normalizedRole = role.toUpperCase();
        if (!List.of("MEMBER", "VIEWER").contains(normalizedRole)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitations may grant MEMBER or VIEWER only");
        }
        if (projects.isProjectMember(projectId, normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This user is already a project member");
        }
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires = Instant.now().plus(7, ChronoUnit.DAYS);
        jdbc.update("""
                INSERT INTO project_invitations
                (token_hash, project_id, email, role, created_by, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """, hash(token), projectId, normalizedEmail, normalizedRole, actor, Timestamp.from(expires));
        jdbc.update("""
                INSERT INTO activity_entries (project_id, actor, action, detail)
                VALUES (?, ?, 'invited_member', ?)
                """, projectId, actor, "Invited " + normalizedEmail + " as " + normalizedRole.toLowerCase());
        String inviteUrl = appUrl + "/?invite=" + token;
        return new Invitation(normalizedEmail, normalizedRole, token, inviteUrl, expires);
    }

    @Transactional
    public InviteRegistration accept(RegisterInput input) {
        String email = input.email().trim().toLowerCase();
        List<InviteRow> invitations = jdbc.query("""
                SELECT project_id, email, role, expires_at, accepted_at FROM project_invitations
                WHERE token_hash = ? FOR UPDATE
                """, (rs, row) -> new InviteRow(rs.getLong("project_id"), rs.getString("email"),
                rs.getString("role"), rs.getTimestamp("expires_at").toInstant(),
                rs.getTimestamp("accepted_at")), hash(input.inviteToken()));
        if (invitations.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation link is invalid");
        }
        InviteRow invite = invitations.get(0);
        if (invite.acceptedAt() != null || !invite.expiresAt().isAfter(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation has expired or was already used");
        }
        if (!email.equals(invite.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use the email address this invitation was sent to");
        }

        List<String> users = jdbc.query("SELECT username FROM user_accounts WHERE username = ?",
                (rs, row) -> rs.getString("username"), email);
        if (users.isEmpty()) {
            jdbc.update("INSERT INTO user_accounts (username, password_hash) VALUES (?, ?)",
                    email, passwordEncoder.encode(input.password()));
        } else {
            String passwordHash = jdbc.queryForObject("SELECT password_hash FROM user_accounts WHERE username = ?",
                    String.class, email);
            if (!passwordEncoder.matches(input.password(), passwordHash)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "This account already exists; enter its current password to accept the invitation");
            }
        }
        jdbc.update("""
                INSERT INTO project_members (project_id, username, role) VALUES (?, ?, ?)
                """, invite.projectId(), email, invite.role());
        jdbc.update("UPDATE project_invitations SET accepted_at = ? WHERE token_hash = ?",
                Timestamp.from(Instant.now()), hash(input.inviteToken()));
        jdbc.update("""
                INSERT INTO activity_entries (project_id, actor, action, detail)
                VALUES (?, ?, 'joined_project', ?)
                """, invite.projectId(), email, email + " joined the project");
        return new InviteRegistration(jwtService.issue(email), email);
    }

    @Transactional
    public InviteRegistration signup(SignupInput input) {
        String email = input.email().trim().toLowerCase();
        String role = input.role() == null ? "MEMBER" : input.role().toUpperCase();
        if (!List.of("MEMBER", "VIEWER").contains(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose Member or Viewer");
        }
        List<String> existing = jdbc.query("SELECT username FROM user_accounts WHERE username = ?",
                (rs, row) -> rs.getString("username"), email);
        if (!existing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }
        Long projectId = jdbc.query("""
                SELECT id FROM projects ORDER BY id LIMIT 1
                """, (rs, row) -> rs.getLong("id")).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "No project workspace is available for registration"));
        jdbc.update("INSERT INTO user_accounts (username, password_hash) VALUES (?, ?)",
                email, passwordEncoder.encode(input.password()));
        jdbc.update("INSERT INTO project_members (project_id, username, role) VALUES (?, ?, ?)",
                projectId, email, role);
        jdbc.update("""
                INSERT INTO activity_entries (project_id, actor, action, detail)
                VALUES (?, ?, 'joined_project', ?)
                """, projectId, email, email + " joined as " + role.toLowerCase());
        return new InviteRegistration(jwtService.issue(email), email);
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required to validate invitations", exception);
        }
    }

    private record InviteRow(long projectId, String email, String role, Instant expiresAt,
                             Timestamp acceptedAt) {}
}
