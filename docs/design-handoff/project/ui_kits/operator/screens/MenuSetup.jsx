/* MenuSetup.jsx — caterer tabs, variant table, offers panel, review drawer */

const menuCaterers = [
  { id: "padea",   name: "Padea Kitchen Co.",  offers: 5, variants: 8, unreviewed: 0 },
  { id: "green",   name: "Greenleaf Catering", offers: 3, variants: 6, unreviewed: 3 },
  { id: "atlas",   name: "Atlas Foods",        offers: 4, variants: 7, unreviewed: 0 },
  { id: "bayview", name: "Bayview Provisions", offers: 2, variants: 4, unreviewed: 0 },
];

const menuVariants = {
  green: [
    { name: "Roast pumpkin & quinoa salad",     base: "Roast pumpkin salad",   flags: ["GF","DF","V"],          ing: ["nut-free"], reviewed: true,  offered: true,  avail: true,  customisable: false },
    { name: "Chickpea & spinach curry",          base: "Curry of the day",      flags: ["GF","DF","VG","halal"], ing: ["nut-free"], reviewed: true,  offered: true,  avail: true,  customisable: false },
    { name: "Beef ragu with pappardelle",        base: "Pasta of the day",      flags: [],                       ing: [],           reviewed: false, offered: false, avail: false, customisable: true  },
    { name: "Smoked tofu rice bowl (DF)",        base: "Rice bowl",             flags: ["DF","VG"],              ing: ["soy"],      reviewed: false, offered: true,  avail: true,  customisable: true  },
    { name: "Sesame chicken (NF)",               base: "Asian protein bowl",    flags: ["NF","halal"],           ing: ["sesame"],   reviewed: false, offered: false, avail: true,  customisable: true  },
    { name: "Mediterranean lentil stew (GF/DF)", base: "Stew of the day",       flags: ["GF","DF","VG"],         ing: ["nut-free"], reviewed: true,  offered: true,  avail: true,  customisable: false },
  ],
};

const FlagPill = ({ flag }) => {
  const tone = flag === "halal" ? "brand" : "muted";
  return <Tag tone={tone}>{flag}</Tag>;
};

const MenuSetup = ({ onOpenVariant }) => {
  const [tab, setTab] = React.useState("green");
  const c = menuCaterers.find(c => c.id === tab);
  const variants = menuVariants[tab] || [];
  const offered = variants.filter(v => v.offered);

  return (
    <React.Fragment>
      <PageHeader
        eyebrow={"Menu setup · week of 2026-10-06"}
        title="Menu setup"
        sub="Review dietary and ingredient flags, then select the weekly offers for each caterer. Unreviewed customisable variants block run generation."
        actions={
          <React.Fragment>
            <Button variant="secondary" icon="Plus">New variant</Button>
            <Button variant="primary" icon="Check">Save offers</Button>
          </React.Fragment>
        }
      />

      <Card flush>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={menuCaterers.map(c => ({
            id: c.id,
            label: c.name,
            count: c.unreviewed > 0 ? `· ${c.unreviewed} unreviewed` : null,
          }))}
        />

        <div style={{display: "grid", gridTemplateColumns: "1.6fr 1fr"}}>
          {/* Variant table */}
          <div style={{borderRight: "1px solid var(--border-1)"}}>
            {c && c.unreviewed > 0 && (
              <div style={{padding: 16, borderBottom: "1px solid var(--border-2)"}}>
                <Alert tone="warn" title={`${c.unreviewed} customisable variants unreviewed`}>
                  Customisable variants must have dietary and ingredient flags reviewed before they can be offered.
                </Alert>
              </div>
            )}

            <table className="tbl">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Flags</th>
                  <th>Excludes</th>
                  <th>Review</th>
                  <th>Avail.</th>
                  <th>Offered</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={i}
                      className={`is-clickable ${!v.reviewed && v.customisable ? "row--err" : ""}`}
                      onClick={() => onOpenVariant && onOpenVariant(v)}>
                    <td>
                      <div style={{fontWeight: 500, color: "var(--fg-1)"}}>{v.name}</div>
                      <div className="mono" style={{color: "var(--fg-4)", marginTop: 2}}>{v.base}{v.customisable ? " · customisable" : ""}</div>
                    </td>
                    <td>
                      <div className="row gap-1" style={{flexWrap: "wrap"}}>
                        {v.flags.map(f => <FlagPill key={f} flag={f} />)}
                        {v.flags.length === 0 && <span className="muted" style={{fontSize: 12}}>—</span>}
                      </div>
                    </td>
                    <td>
                      {v.ing.map((x, j) => <Tag key={j} tone="muted">{x}</Tag>)}
                    </td>
                    <td>
                      {v.reviewed
                        ? <StatusBadge token="Approved" label="Reviewed" />
                        : v.customisable
                          ? <StatusBadge token="Unreviewed" />
                          : <StatusBadge token="Approved" label="N/A" variant="muted" />}
                    </td>
                    <td>
                      {v.avail
                        ? <StatusBadge token="Ready" label="Available" />
                        : <StatusBadge token="Superseded" label="Unavailable" />}
                    </td>
                    <td>
                      <input type="checkbox" defaultChecked={v.offered}
                             style={{accentColor: "var(--padea-crimson)"}}
                             onClick={e => e.stopPropagation()} />
                    </td>
                    <td><I name="ChevronRight" size={14} style={{color: "var(--fg-5)"}} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Offers panel */}
          <div style={{padding: 16, display: "flex", flexDirection: "column", gap: 14}}>
            <div>
              <div className="eyebrow">Weekly offers</div>
              <h3 style={{margin: "4px 0 0", fontSize: 16, fontWeight: 600}}>{offered.length} selected for {c && c.name}</h3>
            </div>

            <Alert tone="info">
              Caterer minimum is 20 meals per service. Current forecast across selected offers is 18.
            </Alert>

            <div className="col gap-2">
              {offered.map((v, i) => (
                <div key={i} className="row gap-2" style={{
                  padding: "8px 10px", border: "1px solid var(--border-2)", borderRadius: 7,
                  background: v.reviewed ? "white" : "var(--warn-bg)"
                }}>
                  <div className="grow">
                    <div style={{fontWeight: 500, fontSize: 13.5}}>{v.name}</div>
                    <div className="row gap-1" style={{marginTop: 4, flexWrap: "wrap"}}>
                      {v.flags.map(f => <FlagPill key={f} flag={f} />)}
                    </div>
                  </div>
                  <IconButton icon="X" />
                </div>
              ))}
              {offered.length === 0 && <Empty title="No offers selected" icon="Inbox">Tick the offered column to add variants to this week.</Empty>}
            </div>

            <div className="subtle-divider" />
            <div className="kv">
              <dt>Saved last</dt><dd className="mono">2026-10-05 18:41Z</dd>
              <dt>Saved by</dt><dd>a.mendoza</dd>
              <dt>Run status</dt><dd><StatusBadge token="Unreviewed" label="Cannot generate" /></dd>
            </div>
          </div>
        </div>
      </Card>
    </React.Fragment>
  );
};

window.MenuSetup = MenuSetup;
