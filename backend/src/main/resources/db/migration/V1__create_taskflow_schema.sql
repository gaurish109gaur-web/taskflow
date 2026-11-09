CREATE TABLE projects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL
);

CREATE TABLE user_accounts (
    username VARCHAR(120) PRIMARY KEY,
    password_hash VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_members (
    project_id BIGINT NOT NULL,
    username VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL,
    PRIMARY KEY (project_id, username),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (username) REFERENCES user_accounts(username)
);

CREATE TABLE work_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    title VARCHAR(180) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    status VARCHAR(20) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    assignee VARCHAR(120),
    due_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (assignee) REFERENCES user_accounts(username)
);

CREATE TABLE comments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    author VARCHAR(120) NOT NULL,
    body VARCHAR(2000) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES work_items(id) ON DELETE CASCADE,
    FOREIGN KEY (author) REFERENCES user_accounts(username)
);

CREATE TABLE activity_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    actor VARCHAR(120) NOT NULL,
    action VARCHAR(80) NOT NULL,
    detail VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (actor) REFERENCES user_accounts(username)
);

CREATE TABLE project_invitations (
    token_hash VARCHAR(64) PRIMARY KEY,
    project_id BIGINT NOT NULL,
    email VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_by VARCHAR(120) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (created_by) REFERENCES user_accounts(username)
);
