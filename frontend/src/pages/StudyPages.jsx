import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, BarChart3, BookOpen, CalendarDays, Check,
  CheckCircle2, CheckSquare2, ChevronLeft, ChevronRight, Circle, Clock3,
  Flame, MoreHorizontal, NotebookPen, Pause, Play, Plus, Search, Sparkles,
  Target, Timer, Trash2, TrendingUp, X, RotateCcw,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { dateKey, formatDate, getCompletion, getSubject } from "../data/studyflow.js";
import { NoteEditor, SubjectEditor, TaskEditor } from "../components/Editors.jsx";

const priorityClass = { High: "priority-high", Medium: "priority-medium", Low: "priority-low" };

function EmptyState({ icon: Icon = Sparkles, title, detail, action, onAction }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={21} /></span>
      <strong>{title}</strong><p>{detail}</p>
      {action && <button className="button button-outline" onClick={onAction}><Plus size={15} />{action}</button>}
    </div>
  );
}

function TaskRow({ task, subject, onToggle, onEdit, onDelete, compact = false }) {
  return (
    <div className={`task-row${task.completed ? " task-done" : ""}${compact ? " task-row-compact" : ""}`}>
      <button aria-label={task.completed ? `Mark ${task.title} as pending` : `Complete ${task.title}`} className={`task-check${task.completed ? " checked" : ""}`} onClick={() => onToggle(task.id)}>
        {task.completed && <Check size={12} strokeWidth={3} />}
      </button>
      <button className="task-main" onClick={() => onEdit(task)}>
        <span className="task-title">{task.title}</span>
        <span className="task-subject">{subject?.name ?? "Unassigned"}{!compact && <><span className="dot-separator">·</span><span className="task-due">{task.dueDate ? formatDate(task.dueDate) : "No due date"}</span></>}</span>
      </button>
      <span className={`priority-pill ${priorityClass[task.priority]}`}>{task.priority}</span>
      {!compact && <button aria-label={`Delete ${task.title}`} className="task-delete" onClick={() => onDelete(task.id)}><Trash2 size={15} /></button>}
    </div>
  );
}

function useTaskEditor(subjects, onSave) {
  const [editing, setEditing] = useState(null);
  const open = (task = null) => setEditing(task ?? {});
  const editor = editing !== null ? <TaskEditor onClose={() => setEditing(null)} onSave={(form) => { onSave(form, editing.id); setEditing(null); }} subjects={subjects} task={editing.id ? editing : null} /> : null;
  return { open, editor };
}

export function Dashboard({ data, onToggleTask, onSaveTask, onDeleteTask, onAddSubject }) {
  const navigate = useNavigate();
  const { open, editor } = useTaskEditor(data.subjects, onSaveTask);
  const pending = data.tasks.filter((task) => !task.completed);
  const upcoming = [...pending].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999")).slice(0, 4);
  const completed = data.tasks.filter((task) => task.completed).length;
  const progress = getCompletion(data.tasks);
  const weeklyMinutes = data.sessions.filter((session) => session.date >= dateKey(new Date(Date.now() - 6 * 86400000))).reduce((sum, session) => sum + session.duration, 0);
  const todayLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const weekday = new Intl.DateTimeFormat("en", { weekday: "short" });
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    const key = dateKey(date);
    return { day: weekday.format(date), minutes: data.sessions.filter((session) => session.date === key).reduce((sum, session) => sum + session.duration, 0) };
  });
  const peak = Math.max(...week.map((entry) => entry.minutes), 50);

  return (
    <div className="dashboard-page">
      <section className="welcome-panel">
        <div className="welcome-copy">
          <div className="welcome-kicker"><span className="live-dot" /> YOUR SPACE TO GROW</div>
          <h2>Make today <span>count.</span></h2>
          <p>{todayLabel} <span className="welcome-divider">·</span> You’ve got this, Jamie.</p>
          <button className="welcome-cta" onClick={() => navigate("/focus")}>Start a focus session <ArrowRight size={15} /></button>
        </div>
        <div aria-hidden="true" className="welcome-orbit orbit-one" />
        <div aria-hidden="true" className="welcome-orbit orbit-two" />
        <div className="welcome-illustration" aria-hidden="true"><div className="welcome-sun" /><div className="welcome-book book-a" /><div className="welcome-book book-b" /><div className="welcome-plant">✳</div><div className="welcome-spark spark-a">✦</div><div className="welcome-spark spark-b">✧</div></div>
        <div className="welcome-stat"><span className="welcome-stat-icon"><Flame size={15} /></span><strong>4 days</strong><small>on a streak</small></div>
      </section>

      <div className="dashboard-grid">
        <section className="panel progress-panel">
          <div className="panel-top"><div><span className="panel-eyebrow">YOUR PROGRESS</span><h3>You’re finding your flow</h3></div><span className="panel-icon icon-violet"><Target size={17} /></span></div>
          <div className="progress-summary"><div className="progress-ring"><svg aria-label={`${progress}% task completion`} viewBox="0 0 100 100"><circle className="ring-track" cx="50" cy="50" r="43" /><circle className="ring-progress" cx="50" cy="50" r="43" style={{ strokeDasharray: `${progress * 2.7} 270` }} /></svg><span><strong>{progress}<small>%</small></strong><em>complete</em></span></div>          <div className="progress-stats"><div><span>Tasks completed</span><strong>{completed}<small> / {data.tasks.length}</small></strong></div><div><span>Subjects active</span><strong>{data.subjects.length}</strong></div><div><span>Focus this week</span><strong>{weeklyMinutes ? <>{(weeklyMinutes / 60).toFixed(1)}<small>h</small></> : "0h"}</strong></div></div></div>
          <div className="panel-footnote"><span className="positive-note"><ArrowUpRight size={14} /> Keep it up</span><span>Every session adds up</span></div>
        </section>

        <section className="panel focus-summary-panel">
          <div className="panel-top"><div><span className="panel-eyebrow">FOCUS TIME</span><h3>Your week, in minutes</h3></div><span className="panel-icon icon-mint"><Clock3 size={17} /></span></div>
          <div className="focus-total"><strong>{(weeklyMinutes / 60).toFixed(1)}</strong><span>hours</span><span className="focus-change"><TrendingUp size={13} /> this week</span></div>
          <div aria-label="Focus minutes by day this week" className="week-bars">{week.map((entry, index) => <div className="week-bar-column" key={`${entry.day}-${index}`}><div className={`week-bar ${entry.minutes ? "has-minutes" : ""}`} style={{ height: `${Math.max(8, (entry.minutes / peak) * 55)}px` }} title={`${entry.minutes} minutes`} /><span>{entry.day}</span></div>)}</div>
        </section>

        <section className="panel tasks-panel">
          <div className="panel-top"><div><span className="panel-eyebrow">UP NEXT</span><h3>On your list <span className="heading-count">{pending.length}</span></h3></div><button aria-label="Add task" className="round-add" onClick={() => open()}><Plus size={17} /></button></div>
          <div className="compact-task-list">{upcoming.length ? upcoming.map((task) => <TaskRow compact key={task.id} onDelete={onDeleteTask} onEdit={open} onToggle={onToggleTask} subject={getSubject(data.subjects, task.subjectId)} task={task} />) : <EmptyState detail="A little breathing room feels good." icon={CheckCircle2} title="All caught up!" />}</div>
          <button className="text-link" onClick={() => navigate("/tasks")}>See all tasks <ArrowRight size={14} /></button>
        </section>

        <section className="panel quick-panel">
          <div className="panel-top"><div><span className="panel-eyebrow">MAKE IT HAPPEN</span><h3>Quick actions</h3></div><span className="panel-icon icon-amber"><Sparkles size={16} /></span></div>
          <button className="quick-action" onClick={() => open()}><span className="quick-action-icon quick-task"><CheckSquare2 size={17} /></span><span><strong>Add a task</strong><small>Get it out of your head</small></span><ArrowRight size={15} /></button>
          <button className="quick-action" onClick={() => navigate("/focus")}><span className="quick-action-icon quick-focus"><Timer size={17} /></span><span><strong>Start focusing</strong><small>Make some quiet progress</small></span><ArrowRight size={15} /></button>
          {!data.subjects.length && <button className="button button-outline quick-subject-add" onClick={onAddSubject}><Plus size={14} /> Add your first subject</button>}
        </section>

        <section className="panel subjects-panel">
          <div className="panel-top"><div><span className="panel-eyebrow">YOUR CLASSES</span><h3>Learning in motion</h3></div><button aria-label="Browse subjects" className="icon-quiet" onClick={() => navigate("/subjects")}><ArrowRight size={17} /></button></div>
          <div className="subject-progress-list">{data.subjects.slice(0, 4).map((subject) => {
            const value = getCompletion(data.tasks, subject.id);
            return <div className="subject-progress-row" key={subject.id}><span className={`subject-mini-mark mark-${subject.color}`}>{subject.icon}</span><span className="subject-progress-name">{subject.name}</span><span className="subject-progress-track"><i className={`fill-${subject.color}`} style={{ width: `${value || 18}%` }} /></span><span className="subject-percent">{value}%</span></div>;
          })}{!data.subjects.length && <EmptyState action="Add a subject" detail="Add a class to start tracking your progress." icon={BookOpen} onAction={onAddSubject} title="No subjects yet" />}</div>
        </section>
      </div>
      {editor}
    </div>
  );
}

export function TasksPage({ data, onToggleTask, onSaveTask, onDeleteTask }) {
  const [filter, setFilter] = useState("All tasks");
  const [query, setQuery] = useState("");
  const { open, editor } = useTaskEditor(data.subjects, onSaveTask);
  const filters = ["All tasks", "To do", "Completed"];
  const visible = data.tasks.filter((task) => {
    const matchesFilter = filter === "All tasks" || (filter === "Completed" ? task.completed : !task.completed);
    return matchesFilter && task.title.toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));

  return (
    <div className="content-stack">
      <div className="toolbar">
        <div className="filter-pills">{filters.map((option) => <button className={`filter-pill${filter === option ? " selected" : ""}`} key={option} onClick={() => setFilter(option)}>{option}{option === "To do" && <span>{data.tasks.filter((task) => !task.completed).length}</span>}</button>)}</div>
        <label className="search-field"><Search size={16} /><input aria-label="Search tasks" onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks..." value={query} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</label>
      </div>
      <section className="panel task-table-panel">
        <div className="list-panel-heading"><div><h3>{filter}</h3><span>{visible.length} {visible.length === 1 ? "task" : "tasks"}</span></div><button className="button button-primary" onClick={() => open()}><Plus size={15} /> Add task</button></div>
        <div className="task-list">{visible.map((task) => <TaskRow key={task.id} onDelete={onDeleteTask} onEdit={open} onToggle={onToggleTask} subject={getSubject(data.subjects, task.subjectId)} task={task} />)}
          {!visible.length && <EmptyState action={query ? undefined : "Add a task"} detail={query ? "Try a different search, or clear your filters." : "A clear list is a fresh start. Add your first task."} icon={query ? Search : CheckSquare2} onAction={() => open()} title={query ? "No matches found" : "Nothing on your list yet"} />}
        </div>
      </section>
      {editor}
    </div>
  );
}

export function SubjectsPage({ data, onAddSubject }) {
  const [showEditor, setShowEditor] = useState(false);
  return (
    <div className="content-stack">
      <div className="subjects-intro"><div><span className="small-muted">A subject for every curious thought.</span><span className="subject-total">{data.subjects.length} {data.subjects.length === 1 ? "subject" : "subjects"}</span></div><button className="button button-primary" onClick={() => setShowEditor(true)}><Plus size={15} /> Add subject</button></div>
      {data.subjects.length ? <div className="subject-card-grid">{data.subjects.map((subject) => {
        const relatedTasks = data.tasks.filter((task) => task.subjectId === subject.id);
        const completion = getCompletion(data.tasks, subject.id);
        const upcoming = relatedTasks.filter((task) => !task.completed).length;
        return <article className={`subject-card subject-card-${subject.color}`} key={subject.id}>
          <div className="subject-card-top"><span className={`subject-large-mark mark-${subject.color}`}>{subject.icon}</span><button aria-label={`More options for ${subject.name}`} className="icon-quiet"><MoreHorizontal size={19} /></button></div>
          <h3>{subject.name}</h3><div className="subject-card-stats"><span><CheckSquare2 size={14} /> {upcoming} upcoming</span><span><Circle size={7} fill="currentColor" /> {relatedTasks.length} tasks</span></div>
          <div className="subject-topics">{subject.topics.length ? subject.topics.map((topic) => <span key={topic}>{topic}</span>) : <span className="topic-placeholder">No topics added yet</span>}</div>
          <div className="subject-completion"><div><span>Coursework progress</span><strong>{completion}%</strong></div><div className="progress-track"><i className={`fill-${subject.color}`} style={{ width: `${completion}%` }} /></div></div>
        </article>;
      })}<button className="add-subject-card" onClick={() => setShowEditor(true)}><span><Plus size={20} /></span><strong>Add another subject</strong><small>Make space for something new</small></button></div> : <section className="panel"><EmptyState action="Add your first subject" detail="Keep classes, tasks, and notes organized in one place." icon={BookOpen} onAction={() => setShowEditor(true)} title="Your learning starts here" /></section>}
      {showEditor && <SubjectEditor onClose={() => setShowEditor(false)} onSave={(form) => { onAddSubject(form); setShowEditor(false); }} />}
    </div>
  );
}

export function NotesPage({ data, onSaveNote, onDeleteNote }) {
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const visible = data.notes.filter((note) => {
    const subjectName = getSubject(data.subjects, note.subjectId)?.name ?? "";
    const matchesSearch = `${note.title} ${note.content} ${note.tags.join(" ")} ${subjectName}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (subjectFilter === "all" || note.subjectId === subjectFilter);
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="content-stack">
      <div className="toolbar notes-toolbar">
        <label className="search-field"><Search size={16} /><input aria-label="Search notes" onChange={(event) => setSearch(event.target.value)} placeholder="Search your notes..." value={search} />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</label>
        <select aria-label="Filter notes by subject" className="subject-select" onChange={(event) => setSubjectFilter(event.target.value)} value={subjectFilter}><option value="all">All subjects</option>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
        <button className="button button-primary" onClick={() => setEditing({})}><Plus size={15} /> New note</button>
      </div>
      {visible.length ? <div className="notes-grid">{visible.map((note) => {
        const subject = getSubject(data.subjects, note.subjectId);
        return <article className="note-card" key={note.id}>
          <div className="note-card-top"><span className={`note-subject-mark mark-${subject?.color ?? "violet"}`}><BookOpen size={13} /></span><span className="note-subject-name">{subject?.name ?? "Unassigned"}</span><button aria-label={`Delete ${note.title}`} className="note-delete" onClick={() => onDeleteNote(note.id)}><Trash2 size={15} /></button></div>
          <button className="note-card-content" onClick={() => setEditing(note)}><h3>{note.title}</h3><p>{note.content}</p></button>
          <div className="note-tags">{note.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
          <div className="note-card-footer"><span>Updated {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(note.updatedAt))}</span><button onClick={() => setEditing(note)}>Open note <ArrowRight size={13} /></button></div>
        </article>;
      })}<button className="add-note-card" onClick={() => setEditing({})}><span><Plus size={19} /></span><strong>Capture a new thought</strong><small>Notes make the best study buddies.</small></button></div> : <section className="panel"><EmptyState action={search ? undefined : "Write your first note"} detail={search ? "Try another keyword or choose a different subject." : "Save the ideas you’ll want to come back to."} icon={NotebookPen} onAction={() => setEditing({})} title={search ? "No notes found" : "Your notebook is empty"} /></section>}
      {editing !== null && <NoteEditor note={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={(form) => { onSaveNote(form, editing.id); setEditing(null); }} subjects={data.subjects} />}
    </div>
  );
}

export function CalendarPage({ data }) {
  const [month, setMonth] = useState(() => { const date = new Date(); date.setDate(1); return date; });
  const [selectedDate, setSelectedDate] = useState(() => dateKey());
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const calendarCells = Array.from({ length: Math.ceil((offset + totalDays) / 7) * 7 }, (_, index) => {
    const dayOfMonth = index - offset + 1;
    if (dayOfMonth < 1 || dayOfMonth > totalDays) return null;
    const date = new Date(month.getFullYear(), month.getMonth(), dayOfMonth);
    return { day: dayOfMonth, key: dateKey(date) };
  });
  const dateEvents = data.tasks.filter((task) => task.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const selectedEvents = dateEvents.filter((task) => task.dueDate === selectedDate);
  const today = dateKey();

  return (
    <div className="calendar-layout">
      <section className="panel calendar-panel">
        <div className="calendar-heading"><div><span className="panel-eyebrow">YOUR MONTH</span><h3>{new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(month)}</h3></div><div className="calendar-controls"><button aria-label="Previous month" className="icon-quiet" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button><button className="today-button" onClick={() => { const date = new Date(); date.setDate(1); setMonth(date); setSelectedDate(dateKey()); }}>Today</button><button aria-label="Next month" className="icon-quiet" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button></div></div>
        <div className="calendar-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{calendarCells.map((cell, index) => {
          if (!cell) return <span aria-hidden="true" className="calendar-empty-cell" key={`empty-${index}`} />;
          const events = dateEvents.filter((task) => task.dueDate === cell.key);
          return <button aria-label={`${formatDate(cell.key, { weekday: "long", month: "long", day: "numeric" })}${events.length ? `, ${events.length} ${events.length === 1 ? "task" : "tasks"}` : ""}`} className={`calendar-day${cell.key === today ? " calendar-today" : ""}${cell.key === selectedDate ? " calendar-selected" : ""}`} key={cell.key} onClick={() => setSelectedDate(cell.key)}>
            <span>{cell.day}</span>{events.length > 0 && <span aria-hidden="true" className="calendar-event-dots">{events.slice(0, 3).map((event) => <i className={`event-dot ${event.completed ? "event-dot-done" : `event-${event.priority.toLowerCase()}`}`} key={event.id} />)}</span>}
          </button>;
        })}</div>
        <div className="calendar-legend"><span><i className="event-dot event-high" /> High priority</span><span><i className="event-dot event-medium" /> Medium</span><span><i className="event-dot event-dot-done" /> Completed</span></div>
      </section>
      <aside className="panel agenda-panel">
        <div className="agenda-heading"><span className="panel-eyebrow">YOUR AGENDA</span><h3>{selectedDate === today ? "Today" : formatDate(selectedDate, { weekday: "long", month: "short", day: "numeric" })}</h3><p>{formatDate(selectedDate, { month: "long", day: "numeric", year: "numeric" })}</p></div>
        {selectedEvents.length ? <div className="agenda-events">{selectedEvents.map((task) => {
          const subject = getSubject(data.subjects, task.subjectId);
          return <div className={`agenda-event agenda-${subject?.color ?? "violet"}`} key={task.id}><span className="agenda-event-time"><span className="event-dot" /> DUE DATE</span><strong>{task.title}</strong><span className="agenda-event-subject">{subject?.name ?? "Unassigned"} <i className={`priority-pill ${priorityClass[task.priority]}`}>{task.priority}</i></span></div>;
        })}</div> : <EmptyState detail="Looks like a little breathing room." icon={CalendarDays} title="Nothing scheduled" />}
        <div className="agenda-upcoming"><span className="panel-eyebrow">COMING UP</span>{dateEvents.filter((task) => !task.completed && task.dueDate > selectedDate).slice(0, 3).map((task) => <div className="agenda-upcoming-row" key={task.id}><span>{formatDate(task.dueDate)}</span><strong>{task.title}</strong></div>)}</div>
      </aside>
    </div>
  );
}

export function FocusPage({ data, onComplete }) {
  const [mode, setMode] = useState("focus25");
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id ?? "");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(25 * 60);
  const modeMinutes = mode === "focus50" ? 50 : mode === "break" ? 5 : 25;
  const totalSeconds = modeMinutes * 60;

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setRemaining((nextMode === "focus50" ? 50 : nextMode === "break" ? 5 : 25) * 60);
    setRunning(false);
  };
  useEffect(() => {
    if (!running) return undefined;
    const interval = window.setInterval(() => setRemaining((seconds) => Math.max(seconds - 1, 0)), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!running || remaining !== 0) return;
    setRunning(false);
    if (mode === "break") return;
    onComplete({ subjectId, duration: modeMinutes });
  }, [remaining, running, onComplete, mode, subjectId, modeMinutes]);

  const displayTime = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  const progress = ((totalSeconds - remaining) / totalSeconds) * 100;
  const sessionCount = data.sessions.filter((session) => session.date === dateKey()).length;
  const currentStreak = data.sessions.filter((session) => session.date >= dateKey(new Date(Date.now() - 6 * 86400000))).length;
  return (
    <div className="focus-layout">
      <section className="focus-main">
        <div className="focus-mode-tabs">{[["focus25", "25 min"], ["focus50", "50 min"], ["break", "Short break"]].map(([value, label]) => <button className={mode === value ? "selected" : ""} key={value} onClick={() => changeMode(value)}>{label}</button>)}</div>
        <div className="timer-stage">
          <div className="timer-glow" />
          <svg aria-hidden="true" className="timer-progress" viewBox="0 0 280 280"><circle className="timer-track" cx="140" cy="140" r="128" /><circle className="timer-arc" cx="140" cy="140" r="128" style={{ strokeDasharray: `${(progress / 100) * 804} 804` }} /></svg>
          <div className="timer-face"><span className="timer-status">{running ? "IN THE ZONE" : mode === "break" ? "TAKE A BREATH" : "READY WHEN YOU ARE"}</span><strong>{displayTime}</strong><span className="timer-session-type">{mode === "break" ? "a little reset" : "deep focus session"}</span></div>
        </div>
        <label className="focus-subject-select"><BookOpen size={15} /><select aria-label="Choose a subject for this focus session" onChange={(event) => setSubjectId(event.target.value)} value={subjectId}><option value="">Choose a subject</option>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
        <div className="timer-controls">
          <button aria-label="Reset timer" className="timer-reset" onClick={() => { setRunning(false); setRemaining(totalSeconds); }}><RotateCcw size={17} /></button>
          <button className="timer-play" onClick={() => setRunning((value) => !value)}>{running ? <><Pause size={18} fill="currentColor" /> Pause</> : <><Play fill="currentColor" size={17} /> Start focusing</>}</button>
          <span className="timer-control-spacer" />
        </div>
        <p className="focus-encouragement"><Sparkles size={14} /> {running ? "You’re doing great. Stay with it." : "Silence the noise. You’ve got this."}</p>
      </section>
      <aside className="focus-aside">
        <div className="focus-side-card focus-tip-card"><span className="focus-side-icon"><Sparkles size={17} /></span><span className="panel-eyebrow">A GENTLE REMINDER</span><h3>Progress over perfection.</h3><p>Focus on one small thing. The rest can wait.</p><div className="tip-decoration">✳</div></div>
        <div className="focus-side-card"><span className="panel-eyebrow">TODAY’S MOMENTUM</span><div className="momentum-metric"><strong>{sessionCount}</strong><span>sessions<br />today</span><span className="momentum-flame"><Flame size={17} /></span></div><div className="momentum-divider" /><div className="momentum-foot"><span>Focus sessions this week</span><strong>{currentStreak}</strong></div></div>
      </aside>
    </div>
  );
}

const chartTooltip = {
  contentStyle: { backgroundColor: "var(--tooltip-bg)", border: "1px solid var(--border-strong)", borderRadius: 12, color: "var(--text-primary)", fontSize: 12 },
  labelStyle: { color: "var(--text-muted)", marginBottom: 4 },
  itemStyle: { color: "var(--text-primary)" },
};

export function AnalyticsPage({ data }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    const key = dateKey(date);
    return { day: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date), hours: Number((data.sessions.filter((session) => session.date === key).reduce((total, session) => total + session.duration, 0) / 60).toFixed(1)) };
  });
  const distribution = data.subjects.map((subject) => ({ name: subject.name, value: data.sessions.filter((session) => session.subjectId === subject.id).reduce((total, session) => total + session.duration, 0), color: ({ mint: "#66d5b3", violet: "#9b8cff", amber: "#f6b85d", rose: "#f58ba1" })[subject.color] ?? "#8b91ff" })).filter((item) => item.value > 0);
  const completedCount = data.tasks.filter((task) => task.completed).length;
  const completionRate = data.tasks.length ? Math.round((completedCount / data.tasks.length) * 100) : 0;
  const studyHours = data.sessions.reduce((sum, session) => sum + session.duration, 0) / 60;
  const stats = [{ label: "Focus hours", value: `${studyHours.toFixed(1)}h`, icon: Timer, tone: "violet", trend: "Your total study time" }, { label: "Tasks completed", value: completedCount, icon: CheckCircle2, tone: "mint", trend: `${completionRate}% completion rate` }, { label: "Study sessions", value: data.sessions.length, icon: Flame, tone: "amber", trend: "Completed focus blocks" }];

  return (
    <div className="content-stack analytics-page">
      <div className="metrics-grid">{stats.map(({ label, value, icon: Icon, tone, trend }) => <article className="panel metric-card" key={label}><div className={`metric-icon metric-${tone}`}><Icon size={17} /></div><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-trend"><ArrowUpRight size={13} /> {trend}</span></article>)}</div>
      <div className="analytics-chart-grid">
        <section className="panel chart-card study-chart"><div className="chart-heading"><div><span className="panel-eyebrow">LAST 7 DAYS</span><h3>Study time</h3></div><span className="chart-legend"><i /> Hours studied</span></div><div className="chart-container"><ResponsiveContainer height="100%" width="100%"><AreaChart data={days} margin={{ top: 14, right: 4, left: -20, bottom: 0 }}><defs><linearGradient id="studyFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#9385ff" stopOpacity={0.28} /><stop offset="100%" stopColor="#9385ff" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} /><XAxis axisLine={false} dataKey="day" tick={{ fill: "var(--text-faint)", fontSize: 11 }} tickLine={false} /><YAxis axisLine={false} domain={[0, "dataMax + 0.4"]} tick={{ fill: "var(--text-faint)", fontSize: 10 }} tickLine={false} width={34} /><Tooltip {...chartTooltip} formatter={(value) => [`${value} hrs`, "Study time"]} /><Area activeDot={{ r: 5, strokeWidth: 0 }} dataKey="hours" fill="url(#studyFill)" stroke="#9a8bff" strokeWidth={2.5} type="monotone" /></AreaChart></ResponsiveContainer></div></section>
        <section className="panel chart-card completion-chart"><div className="chart-heading"><div><span className="panel-eyebrow">A LITTLE AT A TIME</span><h3>Task completion</h3></div><span className="chart-small-icon"><CheckSquare2 size={16} /></span></div><div className="completion-chart-body"><div className="donut-wrap"><ResponsiveContainer height="100%" width="100%"><PieChart><Pie data={[{ name: "Completed", value: completedCount || 0.001 }, { name: "Remaining", value: Math.max(data.tasks.length - completedCount, 0) || 0.001 }]} dataKey="value" innerRadius="74%" outerRadius="91%" paddingAngle={4} stroke="none" startAngle={90} endAngle={-270}><Cell fill="#70d7b6" /><Cell fill="var(--chart-muted)" /></Pie><Tooltip {...chartTooltip} formatter={(value, name) => [name === "Completed" ? completedCount : data.tasks.length - completedCount, name]} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{completionRate}%</strong><span>complete</span></div></div><div className="completion-legend"><span><i className="legend-mint" /> Completed <strong>{completedCount}</strong></span><span><i className="legend-muted" /> Remaining <strong>{data.tasks.length - completedCount}</strong></span></div></div><div className="completion-caption"><span>{completionRate >= 50 ? "You’re past the halfway point!" : "Every completed task counts."}</span><ArrowUpRight size={14} /></div></section>
        <section className="panel chart-card subject-chart"><div className="chart-heading"><div><span className="panel-eyebrow">WHERE YOUR TIME GOES</span><h3>Focus by subject</h3></div><span className="chart-small-icon"><BookOpen size={16} /></span></div>{distribution.length ? <><div className="subject-chart-graph"><ResponsiveContainer height="100%" width="100%"><BarChart data={distribution} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} /><XAxis axisLine={false} dataKey="name" tick={{ fill: "var(--text-faint)", fontSize: 10 }} tickLine={false} /><YAxis axisLine={false} tick={{ fill: "var(--text-faint)", fontSize: 10 }} tickLine={false} width={32} /><Tooltip {...chartTooltip} formatter={(value) => [`${(value / 60).toFixed(1)} hrs`, "Focus time"]} /><Bar dataKey="value" radius={[6, 6, 2, 2]}>{distribution.map((item) => <Cell fill={item.color} key={item.name} />)}</Bar></BarChart></ResponsiveContainer></div><div className="subject-chart-legend">{distribution.map((item) => <span key={item.name}><i style={{ backgroundColor: item.color }} />{item.name}</span>)}</div></> : <EmptyState detail="Your focus time will appear here." icon={BarChart3} title="No study sessions yet" />}</section>
      </div>
    </div>
  );
}
