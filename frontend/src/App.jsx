import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Check, X } from "lucide-react";
import StudyFlowShell from "./components/StudyFlowShell.jsx";
import { SubjectEditor, TaskEditor } from "./components/Editors.jsx";
import useStudyData from "./hooks/useStudyData.js";
import { createId, dateKey } from "./data/studyflow.js";
import {
  AnalyticsPage, CalendarPage, Dashboard, FocusPage, NotesPage, SubjectsPage, TasksPage,
} from "./pages/StudyPages.jsx";

function RoutedApp() {
  const [data, setData] = useStudyData();
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("studyflow-theme") ?? "dark"; }
    catch (error) { console.error("Could not load the saved StudyFlow theme.", error); return "dark"; }
  });
  const [toast, setToast] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [subjectEditorOpen, setSubjectEditorOpen] = useState(false);
  const toastTimer = useRef(null);
  const location = useLocation();

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("studyflow-theme", theme); }
    catch (error) { console.error("Could not save the StudyFlow theme.", error); }
  }, [theme]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => { setToast(""); }, [location.pathname]);

  const saveTask = useCallback((form, id) => {
    setData((current) => ({
      ...current,
      tasks: id
        ? current.tasks.map((task) => task.id === id ? { ...task, ...form } : task)
        : [{ ...form, id: createId(), completed: false }, ...current.tasks],
    }));
    notify(id ? "Task updated" : "Task added to your list");
  }, [notify, setData]);

  const toggleTask = useCallback((id) => {
    const currentTask = data.tasks.find((task) => task.id === id);
    setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task) }));
    notify(currentTask?.completed ? "Task moved back to your list" : "Nicely done — task complete!");
  }, [data.tasks, notify, setData]);

  const deleteTask = useCallback((id) => {
    setData((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }));
    notify("Task deleted");
  }, [notify, setData]);

  const addSubject = useCallback((form) => {
    const palettes = ["mint", "violet", "amber", "rose"];
    const symbols = ["◉", "∫", "⌘", "✳"];
    setData((current) => ({
      ...current,
      subjects: [...current.subjects, { ...form, id: createId(), color: palettes[current.subjects.length % palettes.length], icon: symbols[current.subjects.length % symbols.length] }],
    }));
    notify(`${form.name} added to your subjects`);
  }, [notify, setData]);

  const saveNote = useCallback((form, id) => {
    const note = { ...form, updatedAt: new Date().toISOString() };
    setData((current) => ({
      ...current,
      notes: id ? current.notes.map((item) => item.id === id ? { ...item, ...note } : item) : [{ ...note, id: createId() }, ...current.notes],
    }));
    notify(id ? "Note updated" : "Note saved");
  }, [notify, setData]);

  const deleteNote = useCallback((id) => {
    setData((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== id) }));
    notify("Note deleted");
  }, [notify, setData]);

  const completeSession = useCallback(({ subjectId, duration }) => {
    setData((current) => ({ ...current, sessions: [{ id: createId(), subjectId, duration, date: dateKey() }, ...current.sessions] }));
    notify("Focus session complete — great work!");
  }, [notify, setData]);

  return (
    <>
      <StudyFlowShell data={data} onQuickAdd={() => setQuickAddOpen(true)} onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")} theme={theme}>
        <Routes>
          <Route element={<Dashboard data={data} onAddSubject={() => setSubjectEditorOpen(true)} onDeleteTask={deleteTask} onSaveTask={saveTask} onToggleTask={toggleTask} />} path="/" />
          <Route element={<TasksPage data={data} onDeleteTask={deleteTask} onSaveTask={saveTask} onToggleTask={toggleTask} />} path="/tasks" />
          <Route element={<SubjectsPage data={data} onAddSubject={addSubject} />} path="/subjects" />
          <Route element={<NotesPage data={data} onDeleteNote={deleteNote} onSaveNote={saveNote} />} path="/notes" />
          <Route element={<CalendarPage data={data} />} path="/calendar" />
          <Route element={<FocusPage data={data} onComplete={completeSession} />} path="/focus" />
          <Route element={<AnalyticsPage data={data} />} path="/analytics" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </StudyFlowShell>
      {quickAddOpen && <TaskEditor onClose={() => setQuickAddOpen(false)} onSave={(form) => { saveTask(form); setQuickAddOpen(false); }} subjects={data.subjects} />}
      {subjectEditorOpen && <SubjectEditor onClose={() => setSubjectEditorOpen(false)} onSave={(form) => { addSubject(form); setSubjectEditorOpen(false); }} />}
      <div aria-live="polite" className={`toast${toast ? " toast-visible" : ""}`} role="status">{toast && <><span><Check size={15} /></span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}><X size={14} /></button></>}</div>
    </>
  );
}

export default function App() {
  return <BrowserRouter><RoutedApp /></BrowserRouter>;
}
