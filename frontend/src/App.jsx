import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Client } from "@stomp/stompjs";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  Clock3,
  Copy,
  Hash,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Send,
  Shield,
  Users,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const STATUSES = ["TODO", "IN_PROGRESS", "DONE"];
const OceanEntry = lazy(() => import("./OceanEntry.jsx"));

function EntryAnimation({ onComplete }) {
  return createPortal(
    <Suspense fallback={<div aria-label="Opening your workspace" className="ocean-entry ocean-entry-fallback" role="status" />}>
      <OceanEntry onComplete={onComplete} />
    </Suspense>,
    document.body,
  );
}

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...authHeader(token),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

const statusNames = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

function shortName(username) {
  return username.split("@")[0].replace(/[._-]/g, " ");
}

function initials(username) {
  return shortName(username)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function formatDate(value) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState("admin@taskflow.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inviteToken = new URLSearchParams(window.location.search).get("invite");
  const [signup, setSignup] = useState(false);
  const [role, setRole] = useState("MEMBER");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const endpoint = inviteToken ? "/api/auth/register" : signup ? "/api/auth/signup" : "/api/auth/login";
      const payload = inviteToken
        ? { email: username.trim(), password, inviteToken }
        : signup
          ? { email: username.trim(), password, role }
          : { email: username.trim(), password };
      const result = await request(endpoint, null, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      sessionStorage.setItem("taskflow-auth", result.token);
      if (inviteToken) window.history.replaceState({}, "", window.location.pathname);
      onLogin(result.token, result.username);
    } catch (reason) {
      let message = reason.message || "Sign in failed. Check your email and password.";
      try {
        const parsed = JSON.parse(message);
        message = parsed.error ?? parsed.message ?? message;
      } catch {
        message = message.replace(/^Error:\s*/, "");
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">t</div>
        <p className="eyebrow">{inviteToken ? "YOU'RE INVITED" : signup ? "CREATE YOUR ACCOUNT" : "YOUR TEAM, IN SYNC"}</p>
        <h1>{inviteToken ? "Join your team" : signup ? "Create your account" : "Welcome to Taskflow"}</h1>
        <p className="muted">{inviteToken ? "Use the invited email address. Existing members can enter their current password." : signup ? "Create an account to join the Atlas launch workspace." : "Sign in to open your project workspace."}</p>
        <form className="login-form" onSubmit={submit}>
          <label>
            Work email
            <input
              autoComplete="email"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={username}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              minLength={signup || inviteToken ? 8 : undefined}
              required
              type="password"
              value={password}
            />
          </label>
          {signup && !inviteToken && <label>
            Choose your role
            <select onChange={(event) => setRole(event.target.value)} value={role}>
              <option value="MEMBER">Member — create tasks and join discussions</option>
              <option value="VIEWER">Viewer — view-only access</option>
            </select>
            <small className="role-help">Admin access can only be granted by an existing project admin.</small>
          </label>}
          {error && <p className="form-error">{error}</p>}
          <button className="button button-primary full-width" disabled={busy} type="submit">
            {busy ? (signup || inviteToken ? "Creating account..." : "Signing in...") : (inviteToken ? "Accept invitation" : signup ? "Create account" : "Sign in")}
          </button>
        </form>
        {!inviteToken && <div className="auth-switch">
          <span>{signup ? "Already have an account?" : "New to Taskflow?"}</span>
          <button type="button" onClick={() => { setSignup((current) => !current); setError(""); setPassword(""); }}>
            {signup ? "Sign in" : "Create an account"}
          </button>
        </div>}
        {!inviteToken && !signup && <p className="login-hint">Demo accounts: admin, member, or viewer at <code>taskflow.local</code>. See README for passwords.</p>}
      </section>
    </main>
  );
}

function Avatar({ username, className = "" }) {
  return <span className={`avatar ${className}`}>{initials(username)}</span>;
}

function TaskCard({ task, editable, onClick, onDragStart, onDragEnd, style }) {
  const PriorityIcon = task.priority === "HIGH" ? ArrowUp : task.priority === "LOW" ? ArrowDown : Circle;
  return (
    <button className="task-card" draggable={editable} onClick={onClick} onDragEnd={onDragEnd} onDragStart={(event) => onDragStart(event, task.id)} style={style} type="button">
      <div className="task-card-top">
        <span className="task-id"><Hash size={12} /> TF-{task.id}</span>
        <span className={`priority priority-${task.priority.toLowerCase()}`}>
          <PriorityIcon size={13} /> {task.priority.toLowerCase()}
        </span>
      </div>
      <h3>{task.title}</h3>
      {task.description && <p className="task-description">{task.description}</p>}
      <div className="task-card-footer">
        <span className={task.dueDate ? "due-date" : "due-date muted"}>
          <CalendarDays size={13} /> {formatDate(task.dueDate)}
        </span>
        {task.assignee ? <Avatar username={task.assignee} /> : <span className="unassigned">Unassigned</span>}
      </div>
    </button>
  );
}

function TaskDialog({ task, members, editable, onClose, onSave, onComment }) {
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState(task.status);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setStatus(task.status), [task.status]);

  useEffect(() => {
    let active = true;
    request(`/api/tasks/${task.id}/comments`, sessionStorage.getItem("taskflow-auth"))
      .then((items) => active && setComments(items))
      .catch(() => active && setError("Could not load comments."));
    return () => {
      active = false;
    };
  }, [task.id]);

  async function submitComment(event) {
    event.preventDefault();
    if (!comment.trim()) return;
    setSaving(true);
    setError("");
    try {
      const created = await onComment(task.id, comment.trim());
      setComments((current) => [...current, created]);
      setComment("");
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(value) {
    setStatus(value);
    try {
      await onSave({ ...task, status: value });
    } catch (reason) {
      setStatus(task.status);
      setError(reason.message);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="task-dialog-title" aria-modal="true" className="task-dialog" role="dialog">
        <header className="dialog-header">
          <span className="task-id"><Hash size={13} /> TF-{task.id}</span>
          <button aria-label="Close task" className="icon-button" onClick={onClose}><X size={18} /></button>
        </header>
        <h2 id="task-dialog-title">{task.title}</h2>
        <p className="dialog-description">{task.description || "No description added."}</p>
        <div className="detail-grid">
          <div>
            <span className="detail-label">Status</span>
            {editable ? (
              <select onChange={(event) => changeStatus(event.target.value)} value={status}>
                {STATUSES.map((item) => <option key={item} value={item}>{statusNames[item]}</option>)}
              </select>
            ) : <span className={`status-pill status-${status.toLowerCase()}`}>{statusNames[status]}</span>}
          </div>
          <div>
            <span className="detail-label">Priority</span>
            <span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority.toLowerCase()}</span>
          </div>
          <div>
            <span className="detail-label">Assignee</span>
            {task.assignee ? <span className="assignee-inline"><Avatar username={task.assignee} />{shortName(task.assignee)}</span> : "Unassigned"}
          </div>
          <div>
            <span className="detail-label">Deadline</span>
            <span>{formatDate(task.dueDate)}</span>
          </div>
        </div>
        <section className="comments-section">
          <h3><MessageSquare size={16} /> Discussion <span>{comments.length}</span></h3>
          <div className="comment-list">
            {comments.length === 0 ? <p className="empty-note">No comments yet. Start the conversation.</p> :
              comments.map((item) => (
                <article className="comment" key={item.id}>
                  <Avatar username={item.author} />
                  <div><strong>{shortName(item.author)}</strong><time>{new Date(item.createdAt).toLocaleString()}</time><p>{item.body}</p></div>
                </article>
              ))}
          </div>
          {editable && <form className="comment-form" onSubmit={submitComment}>
            <input aria-label="Write a comment" onChange={(event) => setComment(event.target.value)} placeholder="Write a comment..." value={comment} />
            <button aria-label="Send comment" className="button button-primary" disabled={saving || !comment.trim()} type="submit">Send</button>
          </form>}
          {!editable && <p className="read-only-note"><Shield size={14} /> Viewer access is read-only.</p>}
          {error && <p className="form-error">{error}</p>}
        </section>
      </section>
    </div>
  );
}

function CreateTaskDialog({ members, onClose, onCreate }) {
  const [form, setForm] = useState({ title: "", description: "", priority: "MEDIUM", assignee: "", dueDate: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onCreate({
        ...form,
        assignee: form.assignee || null,
        dueDate: form.dueDate || null,
        status: "TODO",
      });
      onClose();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="create-dialog-title" aria-modal="true" className="create-dialog" role="dialog">
        <header className="dialog-header"><h2 id="create-dialog-title">Create task</h2><button aria-label="Close" className="icon-button" onClick={onClose}><X size={18} /></button></header>
        <form className="create-form" onSubmit={submit}>
          <label>Task title<input autoFocus maxLength="180" onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What needs to get done?" required value={form.title} /></label>
          <label>Description<textarea maxLength="2000" onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add a few details..." rows="3" value={form.description} /></label>
          <div className="form-row">
            <label>Priority<select onChange={(event) => setForm({ ...form, priority: event.target.value })} value={form.priority}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></label>
            <label>Deadline<input onChange={(event) => setForm({ ...form, dueDate: event.target.value })} type="date" value={form.dueDate} /></label>
          </div>
          <label>Assignee<select onChange={(event) => setForm({ ...form, assignee: event.target.value })} value={form.assignee}><option value="">Unassigned</option>{members.map((member) => <option key={member.username} value={member.username}>{shortName(member.username)}</option>)}</select></label>
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-actions"><button className="button button-quiet" onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving} type="submit">{saving ? "Creating..." : "Create task"}</button></div>
        </form>
      </section>
    </div>
  );
}

function InviteDialog({ projectId, token, onClose }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await request(`/api/projects/${projectId}/invitations`, token, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      setInvitation(created);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invitation.inviteUrl);
      setCopied(true);
      setError("");
    } catch {
      setError("Could not copy the link. Select and copy it manually.");
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="invite-dialog-title" aria-modal="true" className="create-dialog" role="dialog">
        <header className="dialog-header"><h2 id="invite-dialog-title">Invite a teammate</h2><button aria-label="Close" className="icon-button" onClick={onClose}><X size={18} /></button></header>
        {invitation ? (
          <div className="invite-result">
            <p className="muted">Share this single-use invitation link with <strong>{invitation.email}</strong>. It expires in 7 days.</p>
            <label>Invitation link<input readOnly value={invitation.inviteUrl} /></label>
            <div className="dialog-actions"><button className="button button-quiet" onClick={onClose} type="button">Done</button><button className="button button-primary" onClick={copyInvite} type="button"><Copy size={15} />{copied ? "Copied" : "Copy link"}</button></div>
          </div>
        ) : (
          <form className="create-form" onSubmit={submit}>
            <label>Work email<input autoFocus autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" required type="email" value={email} /></label>
            <label>Project role<select onChange={(event) => setRole(event.target.value)} value={role}><option value="MEMBER">Member — can update tasks and comment</option><option value="VIEWER">Viewer — read only</option></select></label>
            {error && <p className="form-error">{error}</p>}
            <div className="dialog-actions"><button className="button button-quiet" onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving} type="submit"><Send size={15} />{saving ? "Creating..." : "Create invite link"}</button></div>
          </form>
        )}
        {invitation && error && <p className="form-error">{error}</p>}
      </section>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).has("invite")
    ? null
    : sessionStorage.getItem("taskflow-auth"));
  const [username, setUsername] = useState("");
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEntryAnimation, setShowEntryAnimation] = useState(false);
  const [live, setLive] = useState(false);
  const [syncMode, setSyncMode] = useState("connecting");
  const [draggingTask, setDraggingTask] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState("");

  const currentMember = members.find((member) => member.username === username);
  const canEdit = currentMember?.role !== "VIEWER";
  const finishEntryAnimation = useCallback(() => setShowEntryAnimation(false), []);

  const refresh = useCallback(async (currentToken, projectId) => {
    const [nextTasks, nextMembers, nextActivity, nextSummary] = await Promise.all([
      request(`/api/projects/${projectId}/tasks`, currentToken),
      request(`/api/projects/${projectId}/members`, currentToken),
      request(`/api/projects/${projectId}/activity`, currentToken),
      request(`/api/projects/${projectId}/summary`, currentToken),
    ]);
    setTasks(nextTasks);
    setMembers(nextMembers);
    setActivity(nextActivity);
    setSummary(nextSummary);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    Promise.all([request("/api/me", token), request("/api/projects", token)])
      .then(async ([user, projects]) => {
        if (!active) return;
        if (projects.length === 0) throw new Error("This account is not a member of any project.");
        setUsername(user.username);
        setProject(projects[0]);
        await refresh(token, projects[0].id);
      })
      .catch((reason) => {
        sessionStorage.removeItem("taskflow-auth");
        setToken(null);
        setError(reason.message);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token, refresh]);

  useEffect(() => {
    if (!token || !project) return undefined;
    let active = true;
    let client;
    let pollTimer;
    request("/api/health", null)
      .then(({ webSockets }) => {
        if (!active) return;
        if (webSockets) {
          setSyncMode("websocket");
          client = new Client({
            brokerURL: `${API_URL.replace(/^http/, "ws")}/ws`,
            connectHeaders: { Authorization: `Bearer ${token}` },
            reconnectDelay: 3000,
            onConnect: () => {
              setLive(true);
              client.subscribe(`/topic/projects/${project.id}`, () => {
                refresh(token, project.id).catch((reason) => setError(reason.message));
              });
            },
            onWebSocketClose: () => setLive(false),
            onStompError: () => setLive(false),
          });
          client.activate();
        } else {
          setSyncMode("polling");
          setLive(true);
          pollTimer = window.setInterval(() => {
            refresh(token, project.id).catch((reason) => setError(reason.message));
          }, 3000);
        }
      })
      .catch((reason) => {
        if (!active) return;
        setLive(false);
        setSyncMode("connecting");
        setError(`Backend health check failed: ${reason.message}`);
      });
    return () => {
      active = false;
      if (pollTimer) window.clearInterval(pollTimer);
      setLive(false);
      if (client) client.deactivate();
    };
  }, [token, project, refresh]);

  const tasksByStatus = useMemo(() => {
    const filtered = tasks.filter((task) =>
      `${task.title} ${task.description} ${task.assignee ?? ""}`.toLowerCase().includes(search.toLowerCase()),
    );
    return STATUSES.map((status) => ({ status, items: filtered.filter((task) => task.status === status) }));
  }, [tasks, search]);

  async function createTask(input) {
    const created = await request(`/api/projects/${project.id}/tasks`, token, {
      method: "POST",
      body: JSON.stringify(input),
    });
    await refresh(token, project.id);
    return created;
  }

  async function saveTask(input) {
    const saved = await request(`/api/tasks/${input.id}/status`, token, {
      method: "PATCH",
      body: JSON.stringify({ status: input.status }),
    });
    setTasks((current) => current.map((task) => task.id === saved.id ? saved : task));
    await refresh(token, project.id);
    setSelectedTask((current) => current?.id === saved.id ? saved : current);
    return saved;
  }

  async function moveTask(taskId, status) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === status || !canEdit) return;
    try {
      await saveTask({ ...task, status });
      setError("");
    } catch (reason) {
      setError(`Could not move task: ${reason.message}`);
    } finally {
      setDraggingTask(null);
      setDragOverStatus("");
    }
  }

  async function addComment(taskId, body) {
    const comment = await request(`/api/tasks/${taskId}/comments`, token, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    const nextActivity = await request(`/api/projects/${project.id}/activity`, token);
    setActivity(nextActivity);
    return comment;
  }

  function signOut() {
    sessionStorage.removeItem("taskflow-auth");
    setToken(null);
    setUsername("");
    setProject(null);
    setTasks([]);
    setMembers([]);
    setActivity([]);
    setSummary(null);
    setError("");
  }

  if (!token) return <Login onLogin={(nextToken, name) => { setUsername(name); setToken(nextToken); setLoading(true); setError(""); setShowEntryAnimation(true); }} />;
  if (loading) return <>
    <main className="loading-screen"><span className="brand-mark">t</span><p>Opening your workspace...</p></main>
    {showEntryAnimation && <EntryAnimation onComplete={finishEntryAnimation} />}
  </>;
  if (!project) return <main className="loading-screen"><p className="form-error">{error || "Could not load your project."}</p><button className="button button-quiet" onClick={signOut}>Sign out</button></main>;

  const doneCount = summary?.done ?? tasks.filter((task) => task.status === "DONE").length;
  const taskCount = summary?.total ?? tasks.length;
  const progress = taskCount ? Math.round((doneCount / taskCount) * 100) : 0;
  const teamAvatars = members.slice(0, 4);
  const canInvite = currentMember?.role === "ADMIN";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-mark">t</span><span>taskflow</span></a>
        <div className="workspace-label">WORKSPACE</div>
        <button className="nav-item active"><LayoutDashboard size={17} /> Overview</button>
        <button className="nav-item"><ListTodo size={17} /> My tasks <span className="nav-count">{tasks.filter((task) => task.assignee === username && task.status !== "DONE").length}</span></button>
        <button className="nav-item"><Activity size={17} /> Activity</button>
        <div className="sidebar-divider" />
        <div className="workspace-label">YOUR PROJECTS <button aria-label="Add project" className="tiny-add"><Plus size={14} /></button></div>
        <button className="project-nav selected"><span className="project-dot" />{project.name}<ChevronDown size={14} /></button>
        <div className="sidebar-bottom">
          <div className="plan-card"><div className="plan-icon"><CheckCircle2 size={16} /></div><strong>Project health</strong><p>{progress}% of tasks complete</p><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>
          <button className="user-menu" onClick={signOut}><Avatar username={username} /><span><strong>{shortName(username)}</strong><small>{currentMember?.role?.toLowerCase() ?? "member"}</small></span><LogOut className="logout-icon" size={16} /></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Projects</span><span className="crumb-slash">/</span><strong>{project.name}</strong></div>
          <div className="topbar-actions"><span className={`live-indicator ${live ? "connected" : ""}`}><span />{live ? (syncMode === "polling" ? "Auto-refresh" : "Live updates") : "Connecting"}</span><button aria-label="Notifications" className="icon-button"><Bell size={18} /></button><div className="topbar-avatar"><Avatar username={username} /></div></div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div><div className="eyebrow">{project.description}</div><h1>{project.name}</h1><p className="muted">A shared space to plan, track, and ship great work.</p></div>
            <div className="heading-actions"><div className="avatar-stack">{teamAvatars.map((member) => <Avatar key={member.username} username={member.username} />)}<span className="team-count"><Users size={13} /> {members.length}</span></div>{canInvite && <button className="button button-quiet" onClick={() => setShowInvite(true)}><Users size={16} /> Invite</button>}{canEdit && <button className="button button-primary" onClick={() => setShowCreate(true)}><Plus size={17} /> New task</button>}</div>
          </div>

          <section className="stats-grid" style={{ "--card-count": 4 }}>
            <article className="stat-card"><div className="stat-icon stat-violet"><ListTodo size={18} /></div><span className="stat-label">Total tasks</span><strong>{taskCount}</strong><small>Across this project</small></article>
            <article className="stat-card"><div className="stat-icon stat-amber"><Clock3 size={18} /></div><span className="stat-label">In progress</span><strong>{summary?.inProgress ?? tasks.filter((task) => task.status === "IN_PROGRESS").length}</strong><small>Work underway</small></article>
            <article className="stat-card"><div className="stat-icon stat-green"><Check size={18} /></div><span className="stat-label">Completed</span><strong>{doneCount}</strong><small>{progress}% completion rate</small></article>
            <article className="stat-card"><div className="stat-icon stat-blue"><CalendarDays size={18} /></div><span className="stat-label">Overdue</span><strong>{summary?.overdue ?? 0}</strong><small>{summary?.dueSoon ?? 0} deadlines in the next 7 days</small></article>
          </section>

          <div className="board-heading"><div><h2>Project board</h2><p>Keep an eye on what’s moving and what’s next.</p></div><label className="search-box"><Search size={16} /><input aria-label="Search tasks" onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." value={search} /><kbd>⌘ K</kbd></label></div>
          {error && <div className="inline-error">{error}<button onClick={() => setError("")}><X size={14} /></button></div>}

          <div className="dashboard-grid">
            <section className="board">
              {tasksByStatus.map(({ status, items }) => {
                const Icon = status === "TODO" ? Circle : status === "IN_PROGRESS" ? CircleDot : CheckCircle2;
                return <div className={`board-column ${dragOverStatus === status ? "drag-over" : ""}`} key={status}
                  onDragOver={(event) => { if (canEdit) { event.preventDefault(); setDragOverStatus(status); } }}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragOverStatus(""); }}
                  onDrop={(event) => { event.preventDefault(); const taskId = Number(event.dataTransfer.getData("text/plain")) || draggingTask; if (taskId) moveTask(taskId, status); else setDragOverStatus(""); }}>
                  <header className="column-heading"><div className={`column-icon column-${status.toLowerCase()}`}><Icon size={15} /></div><h3>{statusNames[status]}</h3><span className="column-count">{items.length}</span>{status === "TODO" && canEdit && <button aria-label="Create task" className="tiny-add" onClick={() => setShowCreate(true)}><Plus size={15} /></button>}</header>
                  <div className="task-list">{items.length ? items.map((task, index) => <TaskCard editable={canEdit} key={task.id} onClick={() => setSelectedTask(task)} onDragStart={(event, id) => { event.dataTransfer.setData("text/plain", String(id)); event.dataTransfer.effectAllowed = "move"; setDraggingTask(id); }} onDragEnd={() => { setDraggingTask(null); setDragOverStatus(""); }} style={{ "--card-index": index }} task={task} />) : <div className="empty-column">{canEdit ? "Drop a task here" : "Nothing here yet"}</div>}</div>
                  {status === "TODO" && canEdit && <button className="add-task-link" onClick={() => setShowCreate(true)}><Plus size={15} /> Add task</button>}
                </div>;
              })}
            </section>
            <aside className="right-rail">
              <section className="rail-card team-card"><div className="rail-heading"><h3><Users size={16} /> Team</h3><span>{members.length}</span></div><div className="member-list">{members.map((member) => <div className="member-row" key={member.username}><Avatar username={member.username} /><span className="member-name"><strong>{shortName(member.username)}</strong><small>{member.username}</small></span><span className={`role-badge role-${member.role.toLowerCase()}`}>{member.role.toLowerCase()}</span></div>)}</div></section>
              <section className="rail-card activity-card"><div className="rail-heading"><h3><Activity size={16} /> Recent activity</h3><span className="activity-live"><span /></span></div><div className="activity-list">{activity.length ? activity.slice(0, 8).map((entry) => <article className="activity-row" key={entry.id}><Avatar className="activity-avatar" username={entry.actor} /><div><p><strong>{shortName(entry.actor)}</strong> {entry.detail}</p><time>{new Date(entry.createdAt).toLocaleString()}</time></div></article>) : <p className="empty-note">Activity will show up here.</p>}</div></section>
              <div className="role-note"><Shield size={15} /><span>Your role is <strong>{currentMember?.role?.toLowerCase() ?? "member"}</strong>. {canEdit ? "You can create tasks and join discussions." : "You have read-only access."}</span></div>
            </aside>
          </div>
          <footer className="page-footer"><span>Taskflow workspace</span><span>Made for teams that move together</span></footer>
        </div>
      </main>
      {selectedTask && <TaskDialog key={selectedTask.id} editable={canEdit} members={members} onClose={() => setSelectedTask(null)} onComment={addComment} onSave={saveTask} task={selectedTask} />}
      {showCreate && <CreateTaskDialog members={members} onClose={() => setShowCreate(false)} onCreate={createTask} />}
      {showInvite && <InviteDialog projectId={project.id} token={token} onClose={() => setShowInvite(false)} />}
      {showEntryAnimation && <EntryAnimation onComplete={finishEntryAnimation} />}
    </div>
  );
}

export default App;
