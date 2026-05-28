/* Login.jsx — pre-auth screen */

const Login = ({ onSignIn }) => {
  const [email, setEmail] = React.useState("a.mendoza@padea.example");
  const [pw, setPw]       = React.useState("•••••••••");

  return (
    <div style={{
      height: "100vh", display: "grid",
      gridTemplateColumns: "1.1fr 1fr",
      background: "var(--surface-card)",
    }}>
      <div style={{
        background: "var(--padea-crimson)", color: "white",
        padding: "48px 56px", display: "flex", flexDirection: "column",
        justifyContent: "space-between",
      }}>
        <div className="row gap-3" style={{alignItems: "center"}}>
          <img src="../../assets/padea-logo.jpg" alt="" style={{width: 40, height: 40, borderRadius: 8}} />
          <div>
            <div style={{font: "italic 400 28px/1 var(--font-serif)", letterSpacing: "-0.01em"}}>Padea</div>
            <div style={{font: "500 10px/1 var(--font-sans)", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginTop: 4}}>Catering Ops</div>
          </div>
        </div>

        <div style={{maxWidth: 440}}>
          <div style={{
            font: "italic 400 36px/1.15 var(--font-serif)",
            letterSpacing: "-0.01em", marginBottom: 18,
          }}>
            The weekly run, in one place.
          </div>
          <p style={{color: "rgba(255,255,255,0.85)", fontSize: 14.5, lineHeight: 1.55, margin: 0}}>
            Padea catering coordinators use this console to set up the weekly menu,
            review generated orders, record approvals and exports, and inspect
            the audit trail. Restricted-student safety is captured at the
            review step, not inferred at the surface.
          </p>
        </div>

        <div style={{font: "500 11px/1 var(--font-mono)", color: "rgba(255,255,255,0.6)"}}>
          v0.4.2 · staging · 2026-10-05
        </div>
      </div>

      <div style={{display: "flex", alignItems: "center", justifyContent: "center", padding: 40}}>
        <div style={{width: "100%", maxWidth: 360}}>
          <div className="eyebrow mb-2">Operator sign-in</div>
          <h1 style={{font: "600 24px/1.2 var(--font-sans)", margin: "0 0 20px", letterSpacing: "-0.012em"}}>
            Sign in to Padea Catering Ops
          </h1>

          <div className="field">
            <span className="field__label">Work email</span>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <span className="field__label">Password</span>
            <input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} />
            <span className="field__hint">Authenticated through Supabase Auth. SSO not enabled in staging.</span>
          </div>

          <Button variant="primary" iconRight="ArrowRight" onClick={onSignIn} style={{width: "100%", justifyContent: "center", padding: "10px 14px"}}>
            Continue
          </Button>

          <div className="subtle-divider" />

          <button className="btn btn--ghost" style={{width: "100%", justifyContent: "center"}}>
            <I name="Mail" size={14} />
            Send magic link instead
          </button>

          <p className="caption mt-4" style={{color: "var(--fg-4)", textAlign: "center"}}>
            Access is restricted to operations staff. Anonymous reads are disabled.
          </p>
        </div>
      </div>
    </div>
  );
};

window.Login = Login;
