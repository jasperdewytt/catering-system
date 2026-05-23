/* Exports.jsx — communication snapshot + recipients + export events */

const exportCaterers = [
  { id: "padea",   name: "Padea Kitchen Co.",  status: "Exported", events: 2, lines: 4, last: "2026-10-05 20:14Z" },
  { id: "green",   name: "Greenleaf Catering", status: "Pending",  events: 0, lines: 3, last: "—" },
  { id: "atlas",   name: "Atlas Foods",        status: "Blocked",  events: 0, lines: 0, last: "—" },
  { id: "bayview", name: "Bayview Provisions", status: "Pending",  events: 0, lines: 3, last: "—" },
];

const exportRecipients = [
  { name: "Sarah Chen",   role: "Primary",   addr: "sarah@padea-kitchen.example",  field: "to" },
  { name: "Operations",   role: "Shared",    addr: "ops@padea-kitchen.example",     field: "to" },
  { name: "A. Mendoza",   role: "Coordinator", addr: "ops-team@padea.example",       field: "cc" },
];

const exportEvents = [
  { when: "2026-10-05 20:14Z", who: "a.mendoza", what: "Exported v2", note: "Re-export. Resent rendered draft, snapshot reused." },
  { when: "2026-10-05 19:48Z", who: "a.mendoza", what: "Exported v1", note: "Initial export. Snapshot created and frozen." },
];

const exportBodyPreview = `Subject: Padea catering — Week of 2026-10-06 (run 24-W18-03)

Hi Sarah,

Please find the weekly order summary below for the service week beginning
Monday 6 October. This is the approved schedule.

Linden Park College — Monday 6 October
  • Roast pumpkin & quinoa salad     × 6   (GF, DF, V)
  • Chickpea & spinach curry          × 8   (VG, halal)
  • Mediterranean lentil stew         × 4   (GF, DF — allergen-aware)

Total meals: 18
Delivery: Linden Park kitchen, door 4. 10:30 drop.

Approved 2026-10-05 19:14Z by A. Mendoza.
Order run: 24-W18-03 (immutable snapshot).

—
Padea catering ops
`;

const Exports = () => {
  const [selected, setSelected] = React.useState("padea");
  const cat = exportCaterers.find(c => c.id === selected);

  return (
    <React.Fragment>
      <PageHeader
        eyebrow="Exports · 24-W18-03"
        title="Caterer exports"
        sub="Approved run. Recording an export creates an immutable communication snapshot. Repeated exports append events without mutating the original."
        actions={
          <Button variant="ghost" icon="ExternalLink">Open audit log</Button>
        }
      />

      <div style={{display: "grid", gridTemplateColumns: "320px 1fr", gap: 16}}>
        {/* Caterer list */}
        <Card flush title="Caterers" meta={`${exportCaterers.length} on run`}>
          <div className="col">
            {exportCaterers.map(c => (
              <div key={c.id}
                   onClick={() => setSelected(c.id)}
                   style={{
                     padding: "12px 16px",
                     borderBottom: "1px solid var(--border-2)",
                     cursor: "pointer",
                     background: selected === c.id ? "var(--padea-crimson-tint)" : "transparent",
                     borderLeft: selected === c.id ? "2px solid var(--padea-crimson)" : "2px solid transparent",
                   }}>
                <div className="row" style={{justifyContent: "space-between", marginBottom: 6}}>
                  <span style={{fontWeight: 600, fontSize: 13.5,
                                color: selected === c.id ? "var(--padea-crimson)" : "var(--fg-1)"}}>
                    {c.name}
                  </span>
                  <StatusBadge token={c.status} />
                </div>
                <div className="row gap-3" style={{fontSize: 12, color: "var(--fg-4)"}}>
                  <span>{c.lines} lines</span>
                  <span>·</span>
                  <span>{c.events} export{c.events === 1 ? "" : "s"}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Snapshot + recipients + body */}
        <div className="col gap-4">
          <Card>
            <div className="row" style={{justifyContent: "space-between", alignItems: "flex-start"}}>
              <div>
                <div className="eyebrow">Communication snapshot</div>
                <h2 style={{margin: "4px 0 0", fontSize: 18}}>{cat.name}</h2>
                <div className="mono mt-2" style={{color: "var(--fg-3)"}}>
                  Snapshot {cat.status === "Exported" ? "frozen at v1 · 2026-10-05 19:48Z" : "will be created on first export"}
                </div>
              </div>
              <div className="row gap-2">
                <Button variant="secondary" icon="Copy">Copy text</Button>
                <Button variant="secondary" icon="Download">Download .txt</Button>
                <Button variant="primary" icon="Send" disabled={cat.status === "Blocked"}>
                  {cat.status === "Exported" ? "Record re-export" : "Record export"}
                </Button>
              </div>
            </div>

            {cat.status === "Blocked" && (
              <div className="mt-4">
                <Alert tone="err" title="Cannot export — allocation issues">
                  Atlas Foods run is blocked by 3 allocation issues. Resolve issues or record a manual override before exporting.
                </Alert>
              </div>
            )}
          </Card>

          <Card title="Recipients" meta="Captured into snapshot on first export"
                actions={cat.status === "Exported"
                  ? <CountBadge variant="muted">Locked</CountBadge>
                  : <Button size="sm" variant="ghost" icon="Plus">Add recipient</Button>}>
            <table className="tbl">
              <thead>
                <tr><th>Name</th><th>Role</th><th>Address</th><th>Field</th></tr>
              </thead>
              <tbody>
                {exportRecipients.map((r, i) => (
                  <tr key={i}>
                    <td style={{fontWeight: 500}}>{r.name}</td>
                    <td><Tag tone="muted">{r.role}</Tag></td>
                    <td className="mono">{r.addr}</td>
                    <td><Tag tone={r.field === "to" ? "brand" : "muted"}>{r.field.toUpperCase()}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Rendered draft" meta="Deterministic output of order run">
            <pre style={{
              margin: 0,
              background: "var(--surface-sunken)",
              border: "1px solid var(--border-2)",
              borderRadius: 8,
              padding: 14,
              font: "400 12.5px/1.55 var(--font-mono)",
              color: "var(--fg-1)",
              whiteSpace: "pre-wrap",
              maxHeight: 360,
              overflow: "auto",
            }}>{exportBodyPreview}</pre>
          </Card>

          <Card title="Export events" meta={`${cat.events} event${cat.events === 1 ? "" : "s"}`}>
            {cat.events === 0
              ? <Empty title={`No exports recorded for ${cat.name}`} icon="Send">First export will create the immutable snapshot above.</Empty>
              : (
                <div className="col">
                  {exportEvents.slice(0, cat.events).map((e, i) => (
                    <div key={i} className="row gap-3" style={{padding: "10px 0", borderBottom: i < cat.events - 1 ? "1px solid var(--border-2)" : "none"}}>
                      <span className="mono" style={{width: 170, color: "var(--fg-3)"}}>{e.when}</span>
                      <span className="mono" style={{width: 100, color: "var(--fg-2)"}}>{e.who}</span>
                      <span style={{width: 110, color: "var(--fg-1)", fontWeight: 500}}>{e.what}</span>
                      <span style={{flex: 1, color: "var(--fg-3)"}}>{e.note}</span>
                    </div>
                  ))}
                </div>
              )}
          </Card>
        </div>
      </div>
    </React.Fragment>
  );
};

window.Exports = Exports;
