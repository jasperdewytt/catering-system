/* Audit.jsx — filterable append-only event log */

const auditEvents = [
  { when: "2026-10-05 20:14:02Z", who: "a.mendoza", action: "export.recorded",  entity: "communication", target: "padea-kitchen / 24-W18-03", reason: "Re-export. Snapshot reused.", tone: "info" },
  { when: "2026-10-05 19:48:31Z", who: "a.mendoza", action: "export.recorded",  entity: "communication", target: "padea-kitchen / 24-W18-03", reason: "Initial export. Snapshot frozen.", tone: "ok" },
  { when: "2026-10-05 19:14:02Z", who: "a.mendoza", action: "run.approved",      entity: "order_run",     target: "24-W18-03",                  reason: "All variants reviewed.", tone: "ok" },
  { when: "2026-10-05 18:42:11Z", who: "system",    action: "run.generated",     entity: "order_run",     target: "24-W18-03",                  reason: "Auto: validation passed.", tone: "info" },
  { when: "2026-10-05 18:31:50Z", who: "a.mendoza", action: "offers.saved",      entity: "menu",          target: "week 2026-10-06",            reason: "14 offers, 4 caterers.", tone: "info" },
  { when: "2026-10-05 12:08:11Z", who: "j.okafor",  action: "variant.reviewed",  entity: "variant",       target: "Roast pumpkin (DF, GF)",     reason: "Ingredient list checked. No nuts.", tone: "ok" },
  { when: "2026-10-05 09:54:22Z", who: "a.mendoza", action: "override.recorded", entity: "allocation",    target: "Run 24-W18-01 / Y10",        reason: "Late absence override intent; allocation mutation deferred.", tone: "warn" },
  { when: "2026-10-05 09:14:01Z", who: "system",    action: "run.blocked",       entity: "order_run",     target: "24-W18-01",                  reason: "3 allocation issues.", tone: "err" },
  { when: "2026-10-04 22:00:00Z", who: "system",    action: "data.ingested",     entity: "source",        target: "session_facts.csv",          reason: "Auto-ingest cron, 312 rows.", tone: "info" },
  { when: "2026-10-04 18:11:48Z", who: "a.mendoza", action: "variant.marked_unavailable", entity: "variant", target: "Beef ragu",               reason: "Caterer out of stock.", tone: "muted" },
];

const ACTION_TONE = {
  "run.approved":      "ok",
  "export.recorded":   "ok",
  "variant.reviewed":  "ok",
  "run.generated":     "info",
  "offers.saved":      "info",
  "data.ingested":     "info",
  "override.recorded": "warn",
  "run.blocked":       "err",
  "variant.marked_unavailable": "muted",
};

const Audit = () => {
  const [filter, setFilter] = React.useState("all");
  const [selected, setSelected] = React.useState(null);
  const visible = filter === "all" ? auditEvents : auditEvents.filter(e => e.action.split(".")[0] === filter);

  return (
    <React.Fragment>
      <PageHeader
        eyebrow="Audit log"
        title="Audit events"
        sub="Append-only record. Actor, timestamp, entity, reason, and before/after snapshots are captured at the source of truth."
        actions={
          <React.Fragment>
            <Button variant="ghost" icon="Filter">Filters</Button>
            <Button variant="secondary" icon="Download">Export CSV</Button>
          </React.Fragment>
        }
      />

      <div className="row gap-2 mb-4" style={{flexWrap: "wrap"}}>
        <div style={{position: "relative", flex: "0 0 320px"}}>
          <I name="Search" size={14} style={{position: "absolute", left: 11, top: 11, color: "var(--fg-4)"}} />
          <input className="input" style={{paddingLeft: 32}} placeholder="Search by actor, entity, reason…" />
        </div>
        {[
          { id: "all",      label: "All" },
          { id: "run",      label: "Runs" },
          { id: "export",   label: "Exports" },
          { id: "variant",  label: "Variants" },
          { id: "offers",   label: "Offers" },
          { id: "override", label: "Overrides" },
          { id: "data",     label: "Data" },
        ].map(f => (
          <button key={f.id}
                  className={`btn ${filter === f.id ? "btn--primary" : "btn--secondary"} btn--sm`}
                  onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <Card flush>
        <table className="tbl">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Target</th>
              <th>Reason</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e, i) => (
              <tr key={i} className="is-clickable" onClick={() => setSelected(e)}>
                <td className="mono">{e.when}</td>
                <td className="mono">{e.who}</td>
                <td><StatusBadge token="Approved" label={e.action} variant={ACTION_TONE[e.action] || "muted"} /></td>
                <td><Tag tone="muted">{e.entity}</Tag></td>
                <td style={{fontWeight: 500}}>{e.target}</td>
                <td style={{color: "var(--fg-3)", maxWidth: 320}}>{e.reason}</td>
                <td style={{width: 32}}><I name="ChevronRight" size={14} style={{color: "var(--fg-5)"}} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {selected && (
        <div className="scrim" onClick={() => setSelected(null)}>
          <aside className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer__header">
              <div>
                <div className="eyebrow">Audit event</div>
                <h3 style={{marginTop: 4}}>{selected.action}</h3>
              </div>
              <IconButton icon="X" onClick={() => setSelected(null)} />
            </div>
            <div className="drawer__body">
              <div className="kv mb-4">
                <dt>Timestamp</dt><dd className="mono">{selected.when}</dd>
                <dt>Actor</dt><dd className="mono">{selected.who}</dd>
                <dt>Entity</dt><dd><Tag tone="muted">{selected.entity}</Tag></dd>
                <dt>Target</dt><dd>{selected.target}</dd>
                <dt>Tone</dt><dd><StatusBadge token="Approved" label={selected.tone} variant={selected.tone} /></dd>
              </div>
              <div className="eyebrow mb-2">Reason</div>
              <div style={{
                padding: 12, background: "var(--surface-sunken)",
                border: "1px solid var(--border-2)", borderRadius: 8,
                fontSize: 13, color: "var(--fg-1)"
              }}>{selected.reason}</div>

              <div className="eyebrow mb-2 mt-4">Before</div>
              <pre style={{
                margin: 0, background: "var(--surface-sunken)",
                border: "1px solid var(--border-2)", borderRadius: 8,
                padding: 12, font: "400 12px/1.5 var(--font-mono)",
                color: "var(--fg-2)", whiteSpace: "pre-wrap",
              }}>{`{
  "status": "Generated",
  "approved_by": null,
  "approval_note": null
}`}</pre>

              <div className="eyebrow mb-2 mt-4">After</div>
              <pre style={{
                margin: 0, background: "var(--ok-bg)",
                border: "1px solid var(--ok-border)", borderRadius: 8,
                padding: 12, font: "400 12px/1.5 var(--font-mono)",
                color: "var(--ok-fg)", whiteSpace: "pre-wrap",
              }}>{`{
  "status": "Approved",
  "approved_by": "a.mendoza",
  "approval_note": "All variants reviewed."
}`}</pre>
            </div>
            <div className="drawer__footer">
              <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
              <Button variant="secondary" icon="ExternalLink">Open related run</Button>
            </div>
          </aside>
        </div>
      )}
    </React.Fragment>
  );
};

window.Audit = Audit;
