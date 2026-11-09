# Taskflow

Taskflow is a collaborative project management tool inspired by Jira. It includes project workspaces, team roles, task boards, deadlines, comments, activity tracking, and real-time updates through WebSockets.

## Stack

- Java 17+
- Spring Boot 3
- React + Vite
- MySQL-ready backend (H2 in-memory default for local dev)
- STOMP WebSockets for live collaboration

## Included features

- Project board with To Do, In Progress, and Done lanes
- User roles: ADMIN, MEMBER, VIEWER
- Task creation, updates, deadlines, priorities, and assignees
- Comments and activity feed
- Real-time synchronization across clients
- JWT authentication with BCrypt password storage
- Self-service account signup with MEMBER or VIEWER role selection (admin assignment is restricted)
- Admin-generated, seven-day invitation links with single-use registration
- Drag-and-drop task status changes
- Project summary metrics including overdue and upcoming deadlines
- Versioned Flyway database migrations

## Run the frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open http://localhost:5173

## Run the backend

From the project root:

```bash
cd backend
mvn spring-boot:run
```

### No-Maven local fallback

If Maven or Docker is unavailable, you can still run the UI against the included local demo backend. It uses only Node.js built-ins, stores demo data in `backend/taskflow-data.json`, and supports demo login, tasks, comments, invitations, and WebSocket updates. It is intended for local demos only, not production deployments.

Open a second terminal and run:

```bash
cd frontend
npm run start:local-backend
```

Keep that terminal open, then open or refresh http://localhost:5173. Demo users use the passwords listed below.

By default the backend uses an in-memory H2 database. To use MySQL, start the database from the project root:

```bash
docker compose up -d mysql
```

Then start the backend with:

```bash
cd backend
$env:DATABASE_URL = "jdbc:mysql://localhost:3306/taskflow"
$env:DATABASE_USERNAME = "taskflow"
$env:DATABASE_PASSWORD = "taskflow-local"
$env:TASKFLOW_JWT_SECRET = "replace-this-with-a-long-random-secret-at-least-32-characters"
mvn spring-boot:run
```

Flyway applies versioned schema migrations automatically at startup. The Compose database persists in the `taskflow-mysql` volume.

On PowerShell, environment variables use `$env:NAME = "value"`. In POSIX shells, use `export NAME=value`.

## Demo users

- admin@taskflow.local / admin123!
- member@taskflow.local / member123!
- viewer@taskflow.local / viewer123!

The demo passwords can be overridden with `TASKFLOW_ADMIN_PASSWORD`, `TASKFLOW_MEMBER_PASSWORD`, and `TASKFLOW_VIEWER_PASSWORD`. Passwords are only seeded for demo accounts that do not already exist. Set a unique `TASKFLOW_JWT_SECRET` and non-demo credentials before deploying anywhere outside local development.

## Invitation flow

Project admins can create a single-use invitation link for a member or viewer. Share the generated link with the invited email recipient; they can accept it using a new password or an existing Taskflow account password. Invitation links expire after seven days.

Users can also create their own account from the sign-in screen and join the first available workspace as a Member or Viewer. Admin access cannot be self-selected.
