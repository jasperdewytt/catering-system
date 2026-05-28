/* AppShell.jsx — sidebar nav + topbar + content slot. */

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "Dashboard" },
  { id: "weeks",     label: "Weeks",     icon: "Calendar" },
  { id: "menu",      label: "Menu",      icon: "Utensils", count: 3 },
  { id: "validation",label: "Validation",icon: "Shield" },
  { id: "orders",    label: "Orders",    icon: "Orders", count: 2 },
  { id: "exports",   label: "Exports",   icon: "Send" },
];
const NAV_DIR = [
  { id: "caterers", label: "Caterers", icon: "Building" },
  { id: "students", label: "Students", icon: "Users" },
  { id: "audit",    label: "Audit",    icon: "History" },
  { id: "settings", label: "Settings", icon: "Settings" },
];

const Brand = () => (
  <div className="rail__brand">
    <img src="../../assets/padea-logo.jpg" alt="" />
    <div>
      <div className="word">Padea</div>
      <div className="sub">Catering Ops</div>
    </div>
  </div>
);

const NavList = ({ items, current, onSelect }) => (
  <div className="rail__nav">
    {items.map(item => (
      <div key={item.id}
           className={`nav-item ${current === item.id ? "active" : ""}`}
           onClick={() => onSelect(item.id)}>
        <I name={item.icon} size={16} />
        <span>{item.label}</span>
        {item.count != null && <span className="nav-item__count">{item.count}</span>}
      </div>
    ))}
  </div>
);

const Rail = ({ current, onSelect }) => (
  <aside className="rail">
    <Brand />
    <div className="rail__section">Weekly run</div>
    <NavList items={NAV} current={current} onSelect={onSelect} />
    <div className="rail__section">Reference</div>
    <NavList items={NAV_DIR} current={current} onSelect={onSelect} />
    <div className="rail__footer">
      <div className="avatar">AM</div>
      <div className="col">
        <span style={{color: "var(--fg-1)", fontWeight: 500, fontSize: 12.5}}>A. Mendoza</span>
        <span style={{fontSize: 11.5, color: "var(--fg-4)"}}>Ops coordinator</span>
      </div>
      <IconButton icon="Logout" />
    </div>
  </aside>
);

const TopBar = ({ crumbs = [] }) => (
  <header className="topbar">
    <div className="topbar__crumb">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <I name="ChevronRight" size={12} />}
          {i === crumbs.length - 1 ? <b>{c}</b> : <span>{c}</span>}
        </React.Fragment>
      ))}
    </div>
    <div className="topbar__spacer" />
    <span className="global-status">
      <span className="dot" />
      Run generated · 0 issues
    </span>
    <button className="week-switcher">
      <I name="Calendar" size={13} />
      <span>Week of</span>
      <span className="mono">2026-10-06</span>
      <I name="ChevronDown" size={13} />
    </button>
    <IconButton icon="Bell" />
  </header>
);

const PageHeader = ({ eyebrow, title, sub, actions }) => (
  <div className="page-header">
    <div>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {sub && <p className="sub">{sub}</p>}
    </div>
    {actions && <div className="page-header__actions">{actions}</div>}
  </div>
);

const AppShell = ({ current, onSelect, crumbs, children }) => (
  <div className="app">
    <Rail current={current} onSelect={onSelect} />
    <TopBar crumbs={crumbs} />
    <main className="content">
      <div className="content__inner">{children}</div>
    </main>
  </div>
);

Object.assign(window, { AppShell, PageHeader });
