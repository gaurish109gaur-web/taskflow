export const dateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
};

const day = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return dateKey(date);
};

const recentSession = (daysAgo, duration, subjectId) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id: `session-${daysAgo}-${subjectId}`,
    date: dateKey(date),
    duration,
    subjectId,
  };
};

export const seedData = {
  subjects: [
    { id: "biology", name: "Biology", topics: ["Cell biology", "Genetics", "Ecology"], color: "mint", icon: "◉" },
    { id: "calculus", name: "Calculus II", topics: ["Integrals", "Series", "Vectors"], color: "violet", icon: "∫" },
    { id: "history", name: "World History", topics: ["Renaissance", "Trade routes"], color: "amber", icon: "⌘" },
    { id: "literature", name: "Literature", topics: ["Modernism", "Poetry", "The novel"], color: "rose", icon: "✳" },
  ],
  tasks: [
    { id: "task-1", title: "Finish cell division lab report", subjectId: "biology", priority: "High", dueDate: day(1), completed: false },
    { id: "task-2", title: "Problem set 6: integration", subjectId: "calculus", priority: "High", dueDate: day(2), completed: false },
    { id: "task-3", title: "Read chapters 8–9", subjectId: "history", priority: "Medium", dueDate: day(3), completed: false },
    { id: "task-4", title: "Draft poetry analysis", subjectId: "literature", priority: "Low", dueDate: day(5), completed: false },
    { id: "task-5", title: "Review genetics flashcards", subjectId: "biology", priority: "Medium", dueDate: day(-1), completed: true },
    { id: "task-6", title: "Limits and continuity quiz", subjectId: "calculus", priority: "Low", dueDate: day(-2), completed: true },
    { id: "task-7", title: "Outline research essay", subjectId: "history", priority: "Medium", dueDate: day(7), completed: false },
  ],
  notes: [
    { id: "note-1", title: "Mitosis & meiosis", subjectId: "biology", content: "Mitosis creates two genetically identical diploid cells. Meiosis creates four genetically unique haploid cells through two rounds of division.\n\nKey difference: crossing over in prophase I creates genetic variation.", tags: ["exam review", "cell division"], updatedAt: new Date().toISOString() },
    { id: "note-2", title: "Integration techniques", subjectId: "calculus", content: "1. u-substitution: reverse the chain rule\n2. Integration by parts: ∫u dv = uv − ∫v du\n3. Partial fractions for rational functions\n\nTip: try substitution before reaching for a table.", tags: ["formulas", "week 6"], updatedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: "note-3", title: "The Silk Road", subjectId: "history", content: "A network of trade routes connecting East Asia with the Mediterranean. More than goods moved along these routes—religions, technologies, and ideas traveled too.", tags: ["lecture notes"], updatedAt: new Date(Date.now() - 86400000 * 4).toISOString() },
  ],
  sessions: [
    recentSession(6, 50, "biology"),
    recentSession(5, 25, "calculus"),
    recentSession(4, 50, "history"),
    recentSession(3, 25, "biology"),
    recentSession(2, 50, "calculus"),
    recentSession(1, 25, "literature"),
  ],
};

export const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const formatDate = (value, options = { month: "short", day: "numeric" }) => {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en", options).format(new Date(`${value}T12:00:00`));
};

export const getSubject = (subjects, subjectId) => subjects.find((subject) => subject.id === subjectId);

export const getCompletion = (tasks, subjectId) => {
  const relevant = subjectId ? tasks.filter((task) => task.subjectId === subjectId) : tasks;
  return relevant.length ? Math.round((relevant.filter((task) => task.completed).length / relevant.length) * 100) : 0;
};
