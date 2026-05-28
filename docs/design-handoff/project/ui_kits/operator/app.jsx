/* app.jsx — wires the screens and AppShell together. */

const SCREEN_TITLES = {
  dashboard:  ["Padea Catering Ops", "Dashboard"],
  weeks:      ["Padea Catering Ops", "Weeks"],
  menu:       ["Padea Catering Ops", "Week of 6 Oct", "Menu setup"],
  validation: ["Padea Catering Ops", "Week of 6 Oct", "Validation"],
  orders:     ["Padea Catering Ops", "Week of 6 Oct", "Orders"],
  orderrun:   ["Padea Catering Ops", "Week of 6 Oct", "Orders", "Run 24-W18-03"],
  exports:    ["Padea Catering Ops", "Week of 6 Oct", "Exports"],
  caterers:   ["Padea Catering Ops", "Caterers"],
  students:   ["Padea Catering Ops", "Students"],
  audit:      ["Padea Catering Ops", "Audit log"],
  settings:   ["Padea Catering Ops", "Settings"],
};

const SimplePage = ({ title, children }) => (
  <React.Fragment>
    <PageHeader eyebrow="Operator surface" title={title} sub="Wireframe placeholder — see the design system README for the full page plan." />
    <Card>
      <Empty title={`${title} screen not in the first design pass`} icon="Inbox">
        The first design pass covers Dashboard, Menu setup, Order run detail, Exports, and Audit.
        Other routes share the same shell, table, and badge primitives.
      </Empty>
    </Card>
  </React.Fragment>
);

function App() {
  const [authed, setAuthed]     = React.useState(true);
  const [screen, setScreen]     = React.useState("dashboard");

  // Navigate to "orderrun" goes through the Orders nav item.
  const navCurrent = screen === "orderrun" ? "orders" : screen;

  const handleNav = id => setScreen(id);

  if (!authed) {
    return <Login onSignIn={() => setAuthed(true)} />;
  }

  let body;
  switch (screen) {
    case "dashboard":  body = <Dashboard onNavigate={setScreen} />; break;
    case "menu":       body = <MenuSetup />; break;
    case "orders":
    case "orderrun":   body = <OrderRun onOpenExports={() => setScreen("exports")} />; break;
    case "exports":    body = <Exports />; break;
    case "audit":      body = <Audit />; break;
    case "weeks":      body = <SimplePage title="Weeks" />; break;
    case "validation": body = <SimplePage title="Validation" />; break;
    case "caterers":   body = <SimplePage title="Caterers" />; break;
    case "students":   body = <SimplePage title="Students" />; break;
    case "settings":   body = <SimplePage title="Settings" />; break;
    default:           body = <Dashboard onNavigate={setScreen} />;
  }

  return (
    <AppShell current={navCurrent} onSelect={handleNav} crumbs={SCREEN_TITLES[screen]}>
      {body}
    </AppShell>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
