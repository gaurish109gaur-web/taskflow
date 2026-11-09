import { createServer } from "node:http";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT ?? 8080);
const dataPath = fileURLToPath(new URL("./taskflow-data.json", import.meta.url));
const initialState = {
  accounts: {},
  projects: [{ id: 1, name: "Atlas launch", description: "Coordinate the release of the next Atlas platform milestone." }],
  members: [
    { projectId: 1, username: "admin@taskflow.local", role: "ADMIN" },
    { projectId: 1, username: "member@taskflow.local", role: "MEMBER" },
    { projectId: 1, username: "viewer@taskflow.local", role: "VIEWER" },
  ],
  tasks: [],
  comments: [],
  activity: [],
  invitations: [],
  nextTaskId: 1,
  nextCommentId: 1,
  nextActivityId: 1,
};

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password, stored) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let state = existsSync(dataPath) ? JSON.parse(readFileSync(dataPath, "utf8")) : initialState;
let dirty = !existsSync(dataPath);
const tokens = new Map();
const sockets = new Set();
const rank = { VIEWER: 1, MEMBER: 2, ADMIN: 3 };

function seedAccount(username, password) {
  if (!state.accounts[username]) {
    state.accounts[username] = hashPassword(password);
    dirty = true;
  }
}

seedAccount("admin@taskflow.local", process.env.TASKFLOW_ADMIN_PASSWORD ?? "admin123!");
seedAccount("member@taskflow.local", process.env.TASKFLOW_MEMBER_PASSWORD ?? "member123!");
seedAccount("viewer@taskflow.local", process.env.TASKFLOW_VIEWER_PASSWORD ?? "viewer123!");

if (state.projects.length && !state.tasks.length) {
  const today = new Date();
  const date = (offset) => {
    const value = new Date(today);
    value.setDate(value.getDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  state.tasks = [
    makeTask("Finalize release checklist", "Confirm owners, dependencies, and go-live checks.", "IN_PROGRESS", "HIGH", "admin@taskflow.local", date(2)),
    makeTask("Review onboarding flow", "Collect feedback from the support and design teams.", "TODO", "MEDIUM", "member@taskflow.local", date(5)),
    makeTask("Publish API changelog", "Document the latest endpoint and response changes.", "DONE", "LOW", "admin@taskflow.local", date(-1)),
  ];
  state.activity.push({
    id: state.nextActivityId++,
    projectId: 1,
    actor: "admin@taskflow.local",
    action: "created_project",
    detail: "Atlas launch project is ready",
    createdAt: new Date().toISOString(),
  });
  dirty = true;
}

function makeTask(title, description, status, priority, assignee, dueDate) {
  const now = new Date().toISOString();
  return { id: state.nextTaskId++, projectId: 1, title, description, status, priority, assignee, dueDate, createdAt: now, updatedAt: now };
}

function save() {
  if (!dirty) return;
  writeFileSync(dataPath, JSON.stringify(state, null, 2), "utf8");
  dirty = false;
}

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function memberRole(projectId, username) {
  return state.members.find((member) => member.projectId === projectId && member.username === username)?.role;
}

function requireRole(projectId, username, minimum = "VIEWER") {
  const role = memberRole(projectId, username);
  if (!role) fail(403, "You are not a member of this project");
  if (rank[role] < rank[minimum]) fail(403, "Your project role cannot perform this action");
}

function requireTask(taskId, username, minimum = "VIEWER") {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) fail(404, "Task not found");
  requireRole(task.projectId, username, minimum);
  return task;
}

function recordActivity(projectId, actor, action, detail) {
  state.activity.push({ id: state.nextActivityId++, projectId, actor, action, detail, createdAt: new Date().toISOString() });
  dirty = true;
}

function broadcast(projectId, event) {
  const payload = JSON.stringify({ projectId, event });
  for (const socket of sockets) {
    if (socket.projectId === projectId) sendStompMessage(socket, payload);
  }
}

function sendStompMessage(socket, body) {
  const data = `MESSAGE\ndestination:${socket.destination}\ncontent-type:application/json\ncontent-length:${Buffer.byteLength(body)}\n\n${body}\u0000`;
  const payload = Buffer.from(data);
  const header = payload.length < 126
    ? Buffer.from([0x81, payload.length])
    : payload.length < 65536
      ? Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff])
      : null;
  if (!header) return;
  socket.response.write(Buffer.concat([header, payload]));
}

function sendStompFrame(socket, frame) {
  const payload = Buffer.from(frame);
  if (payload.length >= 126) return;
  socket.response.write(Buffer.concat([Buffer.from([0x81, payload.length]), payload]));
}

function parseStompFrame(frame) {
  const [commandAndHeaders, ...bodyParts] = frame.split("\n\n");
  const lines = commandAndHeaders.split("\n");
  const headers = {};
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(":");
    if (separator > 0) headers[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return { command: lines[0]?.trim(), headers, body: bodyParts.join("\n\n") };
}

function handleSocketData(socket, chunk) {
  socket.buffer = Buffer.concat([socket.buffer, chunk]);
  while (socket.buffer.length >= 2) {
    const opcode = socket.buffer[0] & 0x0f;
    const masked = (socket.buffer[1] & 0x80) !== 0;
    let length = socket.buffer[1] & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (socket.buffer.length < 4) return;
      length = socket.buffer.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (socket.buffer.length < 10) return;
      const wideLength = socket.buffer.readBigUInt64BE(2);
      if (wideLength > 1_000_000n) {
        socket.response.destroy();
        return;
      }
      length = Number(wideLength);
      offset = 10;
    }
    const maskLength = masked ? 4 : 0;
    if (socket.buffer.length < offset + maskLength + length) return;
    const mask = masked ? socket.buffer.subarray(offset, offset + 4) : null;
    const payload = Buffer.from(socket.buffer.subarray(offset + maskLength, offset + maskLength + length));
    socket.buffer = socket.buffer.subarray(offset + maskLength + length);
    if (mask) for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];

    if (opcode === 0x8) {
      sockets.delete(socket);
      socket.response.end();
      return;
    }
    if (opcode === 0x9) {
      socket.response.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
      continue;
    }
    if (opcode !== 0x1) continue;
    const raw = payload.toString("utf8").replace(/\u0000+$/, "");
    for (const line of raw.split("\u0000")) {
      if (!line.trim()) continue;
      const frame = parseStompFrame(line);
      if (frame.command === "CONNECT" || frame.command === "STOMP") {
        const authorization = frame.headers.Authorization ?? "";
        const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
        const username = tokens.get(token);
        if (!username) {
          sendStompFrame(socket, "ERROR\nmessage:Authentication required\n\n\u0000");
          socket.response.end();
          return;
        }
        socket.username = username;
        sendStompFrame(socket, "CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\u0000");
      } else if (frame.command === "SUBSCRIBE") {
        const match = frame.headers.destination?.match(/^\/topic\/projects\/(\d+)$/);
        if (!socket.username || !match) {
          sendStompFrame(socket, "ERROR\nmessage:Subscription rejected\n\n\u0000");
          continue;
        }
        const projectId = Number(match[1]);
        if (!memberRole(projectId, socket.username)) {
          sendStompFrame(socket, "ERROR\nmessage:Project access denied\n\n\u0000");
          continue;
        }
        socket.projectId = projectId;
        socket.destination = frame.headers.destination;
      } else if (frame.command === "DISCONNECT") {
        sockets.delete(socket);
        socket.response.end();
        return;
      }
    }
  }
}

async function handleRequest(request, response) {
  const origin = request.headers.origin;
  if (origin === "http://localhost:5173") {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/health") {
    sendJson(response, 200, { status: "ok", webSockets: true, mode: "local-demo" });
    return;
  }

  let body = {};
  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        fail(400, "Request body must be valid JSON");
      }
    }
  }

  let username = null;
  if (!["/api/auth/login", "/api/auth/register", "/api/auth/signup"].includes(path)) {
    const auth = request.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    username = tokens.get(token);
    if (!username) fail(401, "Please sign in again");
  }

  if (request.method === "POST" && path === "/api/auth/login") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!state.accounts[email] || !passwordMatches(String(body.password ?? ""), state.accounts[email])) {
      fail(401, "Invalid email or password");
    }
    const token = randomBytes(32).toString("base64url");
    tokens.set(token, email);
    sendJson(response, 200, { token, username: email, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() });
    return;
  }

  if (request.method === "POST" && path === "/api/auth/signup") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "MEMBER").toUpperCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "Enter a valid email address");
    if (password.length < 8 || password.length > 72) fail(400, "Password must be between 8 and 72 characters");
    if (!["MEMBER", "VIEWER"].includes(role)) fail(400, "Choose Member or Viewer");
    if (state.accounts[email]) fail(409, "An account with this email already exists");
    const project = state.projects[0];
    if (!project) fail(503, "No project workspace is available for registration");
    state.accounts[email] = hashPassword(password);
    state.members.push({ projectId: project.id, username: email, role });
    recordActivity(project.id, email, "joined_project", `${email} joined as ${role.toLowerCase()}`);
    const token = randomBytes(32).toString("base64url");
    tokens.set(token, email);
    dirty = true;
    save();
    broadcast(project.id, { type: "MEMBER_JOINED", projectId: project.id, actor: email });
    sendJson(response, 201, { token, username: email, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() });
    return;
  }

  if (request.method === "POST" && path === "/api/auth/register") {
    const invitation = state.invitations.find((item) => item.token === body.inviteToken);
    if (!invitation || invitation.acceptedAt || new Date(invitation.expiresAt) <= new Date()) fail(400, "Invitation link is invalid, expired, or already used");
    const email = String(body.email ?? "").trim().toLowerCase();
    if (email !== invitation.email) fail(400, "Use the email address this invitation was sent to");
    const password = String(body.password ?? "");
    if (password.length < 8 || password.length > 72) fail(400, "Password must be between 8 and 72 characters");
    if (state.accounts[email] && !passwordMatches(password, state.accounts[email])) {
      fail(401, "This account already exists; enter its current password to accept the invitation");
    }
    state.accounts[email] ??= hashPassword(password);
    state.members.push({ projectId: invitation.projectId, username: email, role: invitation.role });
    invitation.acceptedAt = new Date().toISOString();
    recordActivity(invitation.projectId, email, "joined_project", `${email} joined the project`);
    const token = randomBytes(32).toString("base64url");
    tokens.set(token, email);
    dirty = true;
    save();
    broadcast(invitation.projectId, { type: "MEMBER_JOINED", projectId: invitation.projectId, actor: email });
    sendJson(response, 200, { token, username: email, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() });
    return;
  }

  if (request.method === "GET" && path === "/api/me") {
    sendJson(response, 200, { username });
    return;
  }
  if (request.method === "GET" && path === "/api/projects") {
    const ids = new Set(state.members.filter((member) => member.username === username).map((member) => member.projectId));
    sendJson(response, 200, state.projects.filter((project) => ids.has(project.id)));
    return;
  }

  const inviteMatch = path.match(/^\/api\/projects\/(\d+)\/invitations$/);
  if (request.method === "POST" && inviteMatch) {
    const projectId = Number(inviteMatch[1]);
    requireRole(projectId, username, "ADMIN");
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "").toUpperCase();
    if (!email.includes("@")) fail(400, "Enter a valid email address");
    if (!["MEMBER", "VIEWER"].includes(role)) fail(400, "Invitations may grant MEMBER or VIEWER only");
    if (memberRole(projectId, email)) fail(409, "This user is already a project member");
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    state.invitations.push({ projectId, email, role, token, createdBy: username, createdAt: new Date().toISOString(), expiresAt, acceptedAt: null });
    recordActivity(projectId, username, "invited_member", `Invited ${email} as ${role.toLowerCase()}`);
    dirty = true;
    save();
    const inviteUrl = `${process.env.TASKFLOW_APP_URL ?? "http://localhost:5173"}/?invite=${token}`;
    broadcast(projectId, { type: "INVITATION_CREATED", projectId, actor: username });
    sendJson(response, 201, { email, role, token, inviteUrl, expiresAt });
    return;
  }

  const projectPath = path.match(/^\/api\/projects\/(\d+)\/(tasks|members|activity|summary)$/);
  if (request.method === "GET" && projectPath) {
    const projectId = Number(projectPath[1]);
    const type = projectPath[2];
    requireRole(projectId, username);
    if (type === "tasks") {
      const statusOrder = { IN_PROGRESS: 0, TODO: 1, DONE: 2 };
      sendJson(response, 200, state.tasks.filter((task) => task.projectId === projectId)
        .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.id - b.id));
      return;
    }
    if (type === "members") {
      sendJson(response, 200, state.members.filter((item) => item.projectId === projectId).map(({ username: name, role }) => ({ username: name, role })));
      return;
    }
    if (type === "activity") {
      sendJson(response, 200, state.activity.filter((item) => item.projectId === projectId).slice(-30).reverse());
      return;
    }
    const tasks = state.tasks.filter((task) => task.projectId === projectId);
    const today = new Date().toISOString().slice(0, 10);
    const dueSoon = new Date();
    dueSoon.setDate(dueSoon.getDate() + 7);
    const soon = dueSoon.toISOString().slice(0, 10);
    sendJson(response, 200, {
      projectId,
      total: tasks.length,
      todo: tasks.filter((task) => task.status === "TODO").length,
      inProgress: tasks.filter((task) => task.status === "IN_PROGRESS").length,
      done: tasks.filter((task) => task.status === "DONE").length,
      overdue: tasks.filter((task) => task.status !== "DONE" && task.dueDate && task.dueDate < today).length,
      dueSoon: tasks.filter((task) => task.status !== "DONE" && task.dueDate && task.dueDate >= today && task.dueDate <= soon).length,
    });
  }

  const projectTasksMatch = path.match(/^\/api\/projects\/(\d+)\/tasks$/);
  if (request.method === "POST" && projectTasksMatch) {
    const projectId = Number(projectTasksMatch[1]);
    requireRole(projectId, username, "MEMBER");
    validateTask(body, projectId);
    const task = makeTask(String(body.title).trim(), String(body.description ?? ""), String(body.status ?? "TODO").toUpperCase(),
      String(body.priority ?? "MEDIUM").toUpperCase(), body.assignee || null, body.dueDate || null);
    task.projectId = projectId;
    state.tasks.push(task);
    recordActivity(projectId, username, "created_task", `Created "${task.title}"`);
    dirty = true;
    save();
    broadcast(projectId, { type: "TASK_CREATED", projectId, task, actor: username });
    sendJson(response, 201, task);
    return;
  }

  const taskMatch = path.match(/^\/api\/tasks\/(\d+)(?:\/(status|comments))?$/);
  if (taskMatch) {
    const taskId = Number(taskMatch[1]);
    const suffix = taskMatch[2];
    if (request.method === "GET" && suffix === "comments") {
      requireTask(taskId, username);
      sendJson(response, 200, state.comments.filter((comment) => comment.taskId === taskId));
      return;
    }
    if (request.method === "POST" && suffix === "comments") {
      const task = requireTask(taskId, username, "MEMBER");
      const text = String(body.body ?? "").trim();
      if (!text || text.length > 2000) fail(400, "Comment must contain between 1 and 2000 characters");
      const comment = { id: state.nextCommentId++, taskId, author: username, body: text, createdAt: new Date().toISOString() };
      state.comments.push(comment);
      recordActivity(task.projectId, username, "commented", `Commented on "${task.title}"`);
      dirty = true;
      save();
      broadcast(task.projectId, { type: "COMMENT_ADDED", projectId: task.projectId, task, actor: username });
      sendJson(response, 201, comment);
      return;
    }
    if (request.method === "PATCH" && suffix === "status") {
      const task = requireTask(taskId, username, "MEMBER");
      const status = String(body.status ?? "").toUpperCase();
      if (!["TODO", "IN_PROGRESS", "DONE"].includes(status)) fail(400, "Unsupported task status");
      task.status = status;
      task.updatedAt = new Date().toISOString();
      recordActivity(task.projectId, username, "changed_status", `${task.title} moved to ${status.replace("_", " ").toLowerCase()}`);
      dirty = true;
      save();
      broadcast(task.projectId, { type: "TASK_UPDATED", projectId: task.projectId, task, actor: username });
      sendJson(response, 200, task);
      return;
    }
    if (request.method === "PUT" && !suffix) {
      const task = requireTask(taskId, username, "MEMBER");
      validateTask(body, task.projectId);
      Object.assign(task, {
        title: String(body.title).trim(),
        description: String(body.description ?? ""),
        status: String(body.status ?? "TODO").toUpperCase(),
        priority: String(body.priority ?? "MEDIUM").toUpperCase(),
        assignee: body.assignee || null,
        dueDate: body.dueDate || null,
        updatedAt: new Date().toISOString(),
      });
      recordActivity(task.projectId, username, "updated_task", `Updated "${task.title}"`);
      dirty = true;
      save();
      broadcast(task.projectId, { type: "TASK_UPDATED", projectId: task.projectId, task, actor: username });
      sendJson(response, 200, task);
      return;
    }
  }
  fail(404, "Endpoint not found");
}

function validateTask(body, projectId) {
  const title = String(body.title ?? "").trim();
  if (!title || title.length > 180) fail(400, "Task title must contain between 1 and 180 characters");
  if (String(body.description ?? "").length > 2000) fail(400, "Task description is too long");
  if (!["TODO", "IN_PROGRESS", "DONE"].includes(String(body.status ?? "TODO").toUpperCase())) fail(400, "Unsupported task status");
  if (!["LOW", "MEDIUM", "HIGH"].includes(String(body.priority ?? "MEDIUM").toUpperCase())) fail(400, "Unsupported task priority");
  if (body.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) fail(400, "Deadline must use YYYY-MM-DD format");
  if (body.assignee && !memberRole(projectId, body.assignee)) fail(400, "Assignee must be a project member");
}

const server = createServer((request, response) => {
  handleRequest(request, response)
    .catch((error) => {
      const status = error.status ?? 500;
      if (status >= 500) console.error(error);
      if (!response.headersSent) sendJson(response, status, { status, error: error.message || "Internal server error" });
      else response.end();
    });
});

server.on("upgrade", (request, socket) => {
  if (request.url !== "/ws" || !request.headers["sec-websocket-key"]) {
    socket.destroy();
    return;
  }
  const requestedProtocols = (request.headers["sec-websocket-protocol"] ?? "")
    .split(",")
    .map((protocol) => protocol.trim());
  const stompProtocol = ["v12.stomp", "v11.stomp", "v10.stomp"]
    .find((protocol) => requestedProtocols.includes(protocol));
  if (!stompProtocol) {
    socket.destroy();
    return;
  }
  const accept = createHash("sha1")
    .update(request.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    `Sec-WebSocket-Protocol: ${stompProtocol}`,
    "",
    "",
  ].join("\r\n"));
  const client = { response: socket, buffer: Buffer.alloc(0), username: null, projectId: null, destination: null };
  sockets.add(client);
  socket.on("data", (chunk) => handleSocketData(client, chunk));
  socket.on("close", () => sockets.delete(client));
  socket.on("error", () => sockets.delete(client));
});

server.listen(port, "0.0.0.0", () => {
  save();
  console.log(`Taskflow local backend listening at http://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    save();
    server.close(() => process.exit(0));
  });
}
