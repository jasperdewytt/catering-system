/* Dashboard.jsx — active week + needs-attention + upcoming sessions + recent audit */

const dashAttentionItems = [
  { sev: "err",  msg: "Atlas Foods — 3 allocation issues block run 24-W18-01.",      meta: "Order run · 24-W18-01" },
  { sev: "warn", msg: "3 dish variants unreviewed for Greenleaf Catering.",          meta: "Menu setup" },
  { sev: "warn", msg: "Padea Kitchen Co. minimum not met (forecast 18 / min 20).",  meta: "Caterer · Padea Kitchen" },
  { sev: "info", msg: "Run 24-W18-03 approved 11 min ago, no exports yet recorded.",meta: "Exports" },
];

const dashSessions = [
  { day: "Mon 06 Oct", caterer: "Padea Kitchen Co.",   school: "Linden Park College",  students: 18, status: "Approved",  run: "24-W18-03" },
  { day: "Mon 06 Oct", caterer: "Greenleaf Catering",  school: "Riverbend Academy",    students:  9, status: "Generated", run: "24-W18-02" },
  { day: "Tue 07 Oct", caterer: "Atlas Foods",          school: "Hartfield High",       students: 11, status: "Blocked",   run: "24-W18-01" },
  { day: "Wed 08 Oct", caterer: "Padea Kitchen Co.",   school: "Northgate Grammar",    students:  7, status: "Unreviewed",run: "—" },
  { day: "Thu 09 Oct", caterer: "Bayview Provisions",  school: "Cedar Park Senior",    students: 14, status: "Ready",     run: "—" },
];

const dashAudit = [
  { when: "11 min", who: "a.mendoza", what: "approved run", target: "24-W18-03", reason: "Ops sign-off, no issues." },
  { when: "26 min", who: "a.mendoza", what: "saved offers", target: "week 2026-10-06", reason: "14 offers, 4 caterers." },
  { when: "1 h",    who: "j.okafor",  what: "reviewed variant", target: "Roast pumpkin (DF, GF)", reason: "Ingredient list checked." },
  { when: "2 h",    who: "system",    what: "generated run", target: "24-W18-03", reason: "Auto: validation passed." },
  { when: "3 h",    who: "a.mendoza", what: "marked unavailable", target: "Beef ragu", reason: "Caterer out of stock." },
];

const Dashboard = ({ onNavigate }) => (
  <React.Fragment>
    <PageHeader
      eyebrow="Active week"
      title="Week of 6 October"
      sub="Run 24-W18-03 approved · 1 caterer still blocked · 0 exports recorded."
      actions={
        <React.Fragment>
          <Button variant="secondary" icon="ExternalLink">Open week overview</Button>
          <Button variant="primary" icon="Send" onClick={() => onNavigate("exports")}>Start exports</Button>
        </React.Fragment>
      }
    />

    <div className="grid-4 mb-4">
      <Card>
        <Metric label="Sessions" value="14" hint="across 4 caterers, 5 schools" />
      </Card>
      <Card>
        <Metric label="Order lines" value="42" hint="run 24-W18-03 (active)" />
      </Card>
      <Card>
        <Metric label="Allocation issues" value="3" hint="all on Atlas Foods run" />
      </Card>
      <Card>
        <Metric label="Caterers exported" value="0 / 4" hint="approved drafts ready" />
      </Card>
    </div>

    <div style={{display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16}} className="mb-4">
      <Card title="Needs attention" meta={`${dashAttentionItems.length} items`}>
        <div className="col gap-2">
          {dashAttentionItems.map((a, i) => (
            <div key={i} className="row gap-3" style={{
              padding: "10px 12px", border: "1px solid var(--border-2)",
              borderRadius: 8, background: "var(--n-50)"
            }}>
              <div style={{paddingTop: 1}}>
                <I name={a.sev === "err" ? "OctagonAlert" : a.sev === "warn" ? "AlertCircle" : "CheckCircle"}
                   size={16}
                   style={{color: a.sev === "err" ? "var(--err-solid)" : a.sev === "warn" ? "var(--warn-solid)" : "var(--info-solid)"}} />
              </div>
              <div className="grow">
                <div style={{fontWeight: 500, color: "var(--fg-1)", fontSize: 13.5}}>{a.msg}</div>
                <div className="mono" style={{marginTop: 3}}>{a.meta}</div>
              </div>
              <Button size="sm" variant="ghost" iconRight="ArrowRight">Open</Button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Readiness" meta="4 / 6 ready">
        <div className="check-list">
          <ReadinessItem state="ok"   label="Source data ingested"      sub="03 Oct 14:22" />
          <ReadinessItem state="ok"   label="Menu offers selected"      sub="14 offers" />
          <ReadinessItem state="warn" label="Dish variants reviewed"    sub="3 unreviewed" />
          <ReadinessItem state="ok"   label="Validation passed"         sub="0 errors" />
          <ReadinessItem state="ok"   label="Order run generated"       sub="24-W18-03" />
          <ReadinessItem state="warn" label="Caterer exports recorded"  sub="0 / 4" />
        </div>
        <div className="subtle-divider" />
        <Button variant="secondary" size="sm" iconRight="ArrowRight" onClick={() => onNavigate("menu")}>
          Continue menu setup
        </Button>
      </Card>
    </div>

    <Card title="Upcoming sessions" meta="Week of 6 Oct" flush
          actions={<Button size="sm" variant="ghost" icon="Filter">Filter</Button>}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Day</th><th>Caterer</th><th>School</th>
            <th className="num">Students</th>
            <th>Status</th><th>Run</th><th></th>
          </tr>
        </thead>
        <tbody>
          {dashSessions.map((s, i) => (
            <tr key={i} className="is-clickable" onClick={() => onNavigate("orderrun")}>
              <td>{s.day}</td>
              <td>{s.caterer}</td>
              <td style={{color: "var(--fg-3)"}}>{s.school}</td>
              <td className="num">{s.students}</td>
              <td><StatusBadge token={s.status} /></td>
              <td className="mono">{s.run}</td>
              <td style={{width: 32}}><I name="ChevronRight" size={14} style={{color: "var(--fg-5)"}} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>

    <div className="mt-4">
      <Card title="Recent audit activity" meta="Last 24 h"
            actions={<Button size="sm" variant="ghost" iconRight="ArrowRight" onClick={() => onNavigate("audit")}>Open audit log</Button>}>
        <div className="col">
          {dashAudit.map((e, i) => (
            <div key={i} className="row gap-3" style={{
              padding: "8px 0",
              borderBottom: i < dashAudit.length - 1 ? "1px solid var(--border-2)" : "none"
            }}>
              <span className="mono" style={{width: 56, color: "var(--fg-4)"}}>{e.when}</span>
              <span className="mono" style={{width: 100, color: "var(--fg-2)"}}>{e.who}</span>
              <span style={{width: 150, color: "var(--fg-3)"}}>{e.what}</span>
              <span className="grow" style={{color: "var(--fg-1)", fontWeight: 500, fontSize: 13.5}}>{e.target}</span>
              <span style={{color: "var(--fg-4)", fontSize: 12.5}}>{e.reason}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </React.Fragment>
);

window.Dashboard = Dashboard;
