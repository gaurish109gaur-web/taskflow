import { useEffect, useState } from "react";
import { BookOpen, CalendarDays, Check, X } from "lucide-react";

export function Modal({ title, description, onClose, children, className = "" }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="modal-title" aria-modal="true" className={`modal-card ${className}`} role="dialog">
        <header className="modal-header">
          <div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button aria-label="Close dialog" className="icon-quiet" onClick={onClose}><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function TaskEditor({ task, subjects, onSave, onClose }) {
  const [form, setForm] = useState({
    title: task?.title ?? "",
    subjectId: task?.subjectId ?? subjects[0]?.id ?? "",
    priority: task?.priority ?? "Medium",
    dueDate: task?.dueDate ?? "",
  });
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Modal description="A small step in the right direction." onClose={onClose} title={task ? "Edit task" : "Create a task"}>
      <form className="editor-form" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
        <label className="field-label">Task name<input autoFocus maxLength={100} onChange={update("title")} placeholder="What needs to get done?" required value={form.title} /></label>
        <div className="field-grid">
          <label className="field-label">Subject
            <select onChange={update("subjectId")} required value={form.subjectId}>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              {!subjects.length && <option value="">Add a subject first</option>}
            </select>
          </label>
          <label className="field-label">Priority
            <select onChange={update("priority")} value={form.priority}>
              <option>Low</option><option>Medium</option><option>High</option>
            </select>
          </label>
        </div>
        <label className="field-label">Due date<span className="input-icon"><CalendarDays size={15} /><input onChange={update("dueDate")} type="date" value={form.dueDate} /></span></label>
        <div className="modal-actions"><button className="button button-subtle" onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={!subjects.length} type="submit">{task ? "Save changes" : "Add task"}</button></div>
      </form>
    </Modal>
  );
}

export function SubjectEditor({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [topics, setTopics] = useState("");
  return (
    <Modal description="Give this class a space of its own." onClose={onClose} title="Add a subject">
      <form className="editor-form" onSubmit={(event) => { event.preventDefault(); onSave({ name: name.trim(), topics: topics.split(",").map((topic) => topic.trim()).filter(Boolean) }); }}>
        <label className="field-label">Subject name<input autoFocus maxLength={50} onChange={(event) => setName(event.target.value)} placeholder="e.g. Psychology" required value={name} /></label>
        <label className="field-label">Topics <span className="field-hint">Optional · separate with commas</span><input onChange={(event) => setTopics(event.target.value)} placeholder="e.g. Memory, Learning, Cognition" value={topics} /></label>
        <div className="modal-actions"><button className="button button-subtle" onClick={onClose} type="button">Cancel</button><button className="button button-primary" type="submit"><BookOpen size={15} /> Add subject</button></div>
      </form>
    </Modal>
  );
}

export function NoteEditor({ note, subjects, onSave, onClose }) {
  const [form, setForm] = useState({
    title: note?.title ?? "",
    subjectId: note?.subjectId ?? subjects[0]?.id ?? "",
    content: note?.content ?? "",
    tags: note?.tags?.join(", ") ?? "",
  });
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Modal className="note-modal" description="Capture what you want to remember." onClose={onClose} title={note ? "Edit note" : "New note"}>
      <form className="editor-form" onSubmit={(event) => { event.preventDefault(); onSave({ ...form, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }); }}>
        <label className="field-label">Title<input autoFocus maxLength={100} onChange={update("title")} placeholder="A thought worth keeping..." required value={form.title} /></label>
        <div className="field-grid">
          <label className="field-label">Subject<select onChange={update("subjectId")} value={form.subjectId}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}{!subjects.length && <option value="">No subjects yet</option>}</select></label>
          <label className="field-label">Tags<input onChange={update("tags")} placeholder="exam prep, lecture" value={form.tags} /></label>
        </div>
        <label className="field-label">Your note<textarea className="note-textarea" onChange={update("content")} placeholder="Start writing here... Markdown-style plain text works beautifully." required rows={8} value={form.content} /></label>
        <div className="modal-actions"><button className="button button-subtle" onClick={onClose} type="button">Cancel</button><button className="button button-primary" type="submit"><Check size={15} /> Save note</button></div>
      </form>
    </Modal>
  );
}
