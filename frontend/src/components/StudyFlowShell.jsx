import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3, BookOpen, CalendarDays, CheckSquare2, ChevronDown, Command,
  GraduationCap, LayoutDashboard, Moon, NotebookPen, Sun, Timer, UserRound,
} from "lucide-react";

const navigation = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "My tasks", icon: CheckSquare2 },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
];

const tools = [
  { to: "/focus", label: "Focus room", icon: Timer },
  { to: "/analytics", label: "Insights", icon: BarChart3 },
];

const userName = "gaurish";
const userInitial = userName.charAt(0).toUpperCase();

const titles = {
  "/": ["Good to see you", new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date())],
  "/tasks": ["My tasks", "Stay on top of what’s next"],
  "/subjects": ["Your subjects", "Everything you’re learning, in one place"],
  "/notes": ["Your notes", "Small thoughts. Big breakthroughs."],
  "/calendar": ["Your calendar", "A clear view of your week"],
  "/focus": ["Focus room", "One thing at a time."],
  "/analytics": ["Your insights", "A little progress adds up."],
};

function Brand() {
  return (
    <NavLink aria-label="StudyFlow home" className="brand" to="/">
      <span className="brand-mark"><GraduationCap size={21} strokeWidth={2.2} /></span>
      <span className="brand-name">study<span>flow</span></span>
    </NavLink>
  );
}

function NavItems({ items, label, pendingCount }) {
  return (
    <div className="nav-section">
      <p className="nav-label">{label}</p>
      {items.map(({ to, label: itemLabel, icon: Icon, end }) => (
        <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} end={end} key={to} to={to}>
          <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>{itemLabel}</span>
          {to === "/tasks" && <span className="nav-count">{pendingCount}</span>}
        </NavLink>
      ))}
    </div>
  );
}

export default function StudyFlowShell({ children, data, theme, onToggleTheme, onQuickAdd }) {
  const { pathname } = useLocation();
  const [title, subtitle] = titles[pathname] || titles["/"];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-switcher">
          <span className="workspace-avatar">S</span>
          <span className="workspace-label"><strong>My workspace</strong><small>Personal space</small></span>
          <ChevronDown aria-hidden="true" className="workspace-chevron" size={15} />
        </div>
        <nav aria-label="Main navigation" className="sidebar-nav">
          <NavItems items={navigation} label="WORKSPACE" pendingCount={data.tasks.filter((task) => !task.completed).length} />
          <NavItems items={tools} label="YOUR ROUTINE" />
        </nav>
        <div className="sidebar-bottom">
          <div className="streak-card">
            <div className="streak-icon">✦</div>
            <div><strong>4 day streak</strong><span>You’re building a habit!</span></div>
            <span className="streak-flame">↗</span>
          </div>
          <div className="profile-row">
            <span className="profile-avatar">{userInitial}</span>
            <span className="profile-name"><strong>{userName}</strong><small>Student plan</small></span>
            <button aria-label="Open profile menu" className="icon-quiet"><Command size={16} /></button>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand"><Brand /></div>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{title}</strong></div>
          <div className="topbar-actions">
            <button aria-label="Toggle color theme" className="icon-quiet theme-button" onClick={onToggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="button button-primary topbar-add" onClick={onQuickAdd}><span>+</span> New task</button>
            <span aria-label={userName} className="header-avatar">{userInitial}</span>
            <button aria-label="Account options" className="account-menu"><UserRound size={15} /><ChevronDown size={13} /></button>
          </div>
        </header>
        <main className="page-content">
          <div className="page-heading">
            <div><h1>{title}</h1><p>{subtitle}</p></div>
            <span className="heading-date"><CalendarDays size={14} /> {new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span>
          </div>
          {children}
        </main>
        <nav aria-label="Mobile navigation" className="mobile-bottom-nav">
          {[...navigation, ...tools].map(({ to, label: itemLabel, icon: Icon, end }) => (
            <NavLink className={({ isActive }) => `mobile-nav-link${isActive ? " active" : ""}`} end={end} key={to} to={to}>
              <Icon aria-hidden="true" size={17} strokeWidth={1.9} />
              <span>{itemLabel === "My tasks" ? "Tasks" : itemLabel === "Focus room" ? "Focus" : itemLabel === "Overview" ? "Home" : itemLabel === "Insights" ? "Insights" : itemLabel}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
