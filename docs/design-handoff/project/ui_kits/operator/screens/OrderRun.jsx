/* OrderRun.jsx — run header + order lines + allocations + issue panel */

const runHeader = {
  id: "24-W18-03",
  status: "Approved",
  generated: "2026-10-05 18:42:11Z",
  approved:  "2026-10-05 19:14:02Z",
  approvedBy: "a.mendoza",
  reason: "All variants reviewed. Forecasts within minimums except Atlas (flagged separately).",
  issues: 0,
  lines: 14,
  allocations: 42,
  superseded: ["24-W18-02"],
};

const runLines = [
  { group: "Padea Kitchen Co. · Linden Park College · Mon 06 Oct" },
  { variant: "Roast pumpkin & quinoa salad",     qty: 6,  flags: ["GF","DF","V"],   notes: "Tray service" },
  { variant: "Chickpea & spinach curry",          qty: 8,  flags: ["VG","halal"],    notes: "" },
  { variant: "Mediterranean lentil stew",         qty: 4,  flags: ["GF","DF"],       notes: "Allergen-aware" },
  { group: "Greenleaf Catering · Riverbend Academy · Mon 06 Oct" },
  { variant: "Smoked tofu rice bowl",             qty: 5,  flags: ["DF","VG"],       notes: "" },
  { variant: "Sesame chicken bowl",               qty: 4,  flags: ["NF","halal"],    notes: "Sesame visible on tray" },
  { group: "Bayview Provisions · Cedar Park Senior · Thu 09 Oct" },
  { variant: "Roast chicken with greens",         qty: 9,  flags: ["GF"],            notes: "" },
  { variant: "Pasta primavera",                    qty: 5,  flags: ["V"],             notes: "Adjustable portion" },
  { variant: "Vegan mezze plate",                  qty: 1,  flags: ["VG","DF"],       notes: "Single allocation" },
];

const runAllocations = [
  { student: "Tan, Mei",      year: "Y10", school: "Linden Park",  variant: "Roast pumpkin & quinoa salad", dietary: ["V"],         note: "" },
  { student: "Okonkwo, Ada",  year: "Y10", school: "Linden Park",  variant: "Chickpea & spinach curry",      dietary: ["halal"],     note: "" },
  { student: "Reyes, Mateo",  year: "Y11", school: "Linden Park",  variant: "Mediterranean lentil stew",     dietary: ["GF","DF"],   note: "Coeliac" },
  { student: "Yusuf, Aisha",  year: "Y11", school: "Riverbend",    variant: "Sesame chicken bowl",           dietary: ["NF"],        note: "" },
  { student: "Park, Ji-ho",   year: "Y12", school: "Riverbend",    variant: "Smoked tofu rice bowl",         dietary: ["VG"],        note: "" },
  { student: "Singh, Ravi",   year: "Y09", school: "Cedar Park",   variant: "Roast chicken with greens",     dietary: [],            note: "" },
];

const FlagRow = ({ flags }) => (
  <div className="row gap-1" style={{flexWrap: "wrap"}}>
    {flags.map(f => <Tag key={f} tone={f === "halal" ? "brand" : "muted"}>{f}</Tag>)}
    {flags.length === 0 && <span className="muted" style={{fontSize: 12}}>—</span>}
  </div>
);

const OrderRun = ({ onOpenExports }) => {
  const [tab, setTab] = React.useState("lines");
  const [reopenOpen, setReopenOpen] = React.useState(false);

  return (
    <React.Fragment>
      <PageHeader
        eyebrow={`Order run · ${runHeader.id}`}
        title="Order run 24-W18-03"
        sub={`Generated ${runHeader.generated} · Approved by ${runHeader.approvedBy}, ${runHeader.approved}.`}
        actions={
          <React.Fragment>
            <Button variant="ghost" icon="Download">Export JSON</Button>
            <Button variant="danger" icon="Undo" onClick={() => setReopenOpen(true)}>Reopen run</Button>
            <Button variant="primary" icon="Send" onClick={onOpenExports}>Open exports</Button>
          </React.Fragment>
        }
      />

      {/* Status strip */}
      <Card padded={true} flush={false} className="mb-4">
        <div className="row gap-6" style={{padding: 0, alignItems: "flex-start"}}>
          <div className="col gap-2" style={{flex: 1.4}}>
            <div className="row gap-2">
              <StatusBadge token="Approved" />
              <StatusBadge token="Generated" label="Issue-free" />
              <span className="mono muted">{runHeader.lines} lines · {runHeader.allocations} allocations</span>
            </div>
            <div className="row gap-2" style={{color: "var(--fg-3)", fontSize: 13}}>
              <I name="Sparkles" size={14} />
              <span>Approval note · </span>
              <span style={{color: "var(--fg-1)"}}>{runHeader.reason}</span>
            </div>
          </div>
          <div style={{width: 1, alignSelf: "stretch", background: "var(--border-2)"}} />
          <div className="kv" style={{flex: 1}}>
            <dt>Run ID</dt><dd className="mono">{runHeader.id}</dd>
            <dt>Generated</dt><dd className="mono">{runHeader.generated}</dd>
            <dt>Approved by</dt><dd>{runHeader.approvedBy}</dd>
            <dt>Supersedes</dt><dd>
              {runHeader.superseded.map(r => <span key={r} className="mono" style={{marginRight: 6}}>{r}</span>)}
            </dd>
          </div>
        </div>
      </Card>

      <div className="mb-4">
        <Card flush>
          <Tabs value={tab} onChange={setTab} tabs={[
            { id: "lines",       label: "Order lines",        count: runHeader.lines },
            { id: "allocations", label: "Allocations",        count: runHeader.allocations },
            { id: "issues",      label: "Allocation issues",  count: 0 },
            { id: "contacts",    label: "Contacts & delivery" },
            { id: "history",     label: "Approval history" },
          ]} />

          {tab === "lines" && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th className="num">Qty</th>
                  <th>Dietary</th>
                  <th>Delivery notes</th>
                </tr>
              </thead>
              <tbody>
                {runLines.map((l, i) => l.group ? (
                  <tr key={i} className="group-row"><td colSpan={4}>{l.group}</td></tr>
                ) : (
                  <tr key={i}>
                    <td style={{fontWeight: 500}}>{l.variant}</td>
                    <td className="num">{l.qty}</td>
                    <td><FlagRow flags={l.flags} /></td>
                    <td style={{color: "var(--fg-3)"}}>{l.notes || <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "allocations" && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Student</th><th>Yr</th><th>School</th>
                  <th>Variant</th><th>Dietary</th><th>Note</th>
                </tr>
              </thead>
              <tbody>
                {runAllocations.map((a, i) => (
                  <tr key={i}>
                    <td style={{fontWeight: 500}}>{a.student}</td>
                    <td className="mono">{a.year}</td>
                    <td style={{color: "var(--fg-3)"}}>{a.school}</td>
                    <td>{a.variant}</td>
                    <td><FlagRow flags={a.dietary} /></td>
                    <td style={{color: "var(--fg-3)", fontSize: 12.5}}>{a.note || <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "issues" && (
            <Empty icon="ShieldOff" title="No allocation issues">
              This run was generated cleanly. Issues from prior runs are retained on the audit log.
            </Empty>
          )}

          {tab === "contacts" && (
            <div style={{padding: 18}}>
              <div className="grid-2">
                <Card title="Padea Kitchen Co." meta="2 contacts">
                  <div className="kv">
                    <dt>Primary</dt><dd>Sarah Chen · sarah@padea-kitchen.example</dd>
                    <dt>Delivery</dt><dd>Linden Park kitchen, door 4. 10:30 drop.</dd>
                    <dt>Phone</dt><dd className="mono">+61 4 0000 0000</dd>
                  </div>
                </Card>
                <Card title="Greenleaf Catering" meta="1 contact">
                  <div className="kv">
                    <dt>Primary</dt><dd>Daniel R. · ops@greenleafcat.example</dd>
                    <dt>Delivery</dt><dd>Riverbend gate B, 10:45 drop.</dd>
                    <dt>Phone</dt><dd className="mono">+61 4 0000 0000</dd>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div style={{padding: 18}}>
              <div className="col">
                {[
                  { when: "2026-10-05 19:14Z", who: "a.mendoza", what: "Approved with note", reason: runHeader.reason },
                  { when: "2026-10-05 18:42Z", who: "system",    what: "Run generated",      reason: "Auto: validation passed." },
                  { when: "2026-10-05 18:31Z", who: "a.mendoza", what: "Saved offers",       reason: "14 offers, 4 caterers." },
                  { when: "2026-10-05 12:08Z", who: "j.okafor",  what: "Reviewed 4 variants",reason: "Greenleaf curry, lentil stew, sesame chicken, pumpkin salad." },
                ].map((e, i) => (
                  <div key={i} className="row gap-3" style={{padding: "10px 0", borderBottom: "1px solid var(--border-2)"}}>
                    <span className="mono" style={{width: 170, color: "var(--fg-3)"}}>{e.when}</span>
                    <span className="mono" style={{width: 100, color: "var(--fg-2)"}}>{e.who}</span>
                    <span style={{width: 200, color: "var(--fg-3)"}}>{e.what}</span>
                    <span style={{flex: 1, color: "var(--fg-1)"}}>{e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {reopenOpen && (
        <div className="scrim scrim--center" onClick={() => setReopenOpen(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog__header">
              <h3>Reopen approved run</h3>
              <IconButton icon="X" onClick={() => setReopenOpen(false)} />
            </div>
            <div className="dialog__body">
              <Alert tone="warn" title="Reopening will mark the run as superseded">
                The current run will be retained for audit. A new run must be generated and re-approved.
              </Alert>
              <div className="field mt-4">
                <span className="field__label">Reason</span>
                <input className="input" placeholder="Describe why this run must be reopened" />
                <span className="field__hint">Recorded against your operator account. Reason must reference a session, caterer, or student ID.</span>
              </div>
            </div>
            <div className="dialog__footer">
              <Button variant="ghost" onClick={() => setReopenOpen(false)}>Cancel</Button>
              <Button variant="danger" icon="Undo">Reopen run</Button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
};

window.OrderRun = OrderRun;
