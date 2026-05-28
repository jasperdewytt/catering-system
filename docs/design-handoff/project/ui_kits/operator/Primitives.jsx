/* Primitives.jsx — Button, Badge, Card, Tag, Alert.
   Loads after Icons.jsx. */

const Button = ({ variant = "secondary", size, icon, iconRight, disabled, children, ...props }) => {
  const cls = ["btn", `btn--${variant}`, size === "sm" && "btn--sm", disabled && "is-disabled"]
    .filter(Boolean).join(" ");
  return (
    <button className={cls} {...props}>
      {icon ? <I name={icon} size={14} /> : null}
      {children}
      {iconRight ? <I name={iconRight} size={14} /> : null}
    </button>
  );
};

const IconButton = ({ icon, ...props }) => (
  <button className="icon-btn" {...props}><I name={icon} size={14} /></button>
);

// Status badge with explicit token.
// token is one of: Approved, Exported, Ready, Unreviewed, Generated, Blocked, Superseded
const STATUS_VARIANT = {
  Approved: "ok", Exported: "ok", Ready: "ok", "Issue-free": "ok",
  Unreviewed: "warn", Pending: "warn", "Needs review": "warn",
  Generated: "info", Draft: "info", Active: "info",
  Blocked: "err", Error: "err", Failed: "err",
  Superseded: "muted", Archived: "muted", Inactive: "muted",
};
const StatusBadge = ({ token, label, variant }) => {
  const v = variant || STATUS_VARIANT[token] || "muted";
  return (
    <span className={`badge badge--${v}`}>
      <span className="dot" />
      {label || token}
    </span>
  );
};

const CountBadge = ({ variant = "muted", children }) => (
  <span className={`badge badge--${variant} badge--count`}>{children}</span>
);

const Card = ({ title, meta, actions, padded = true, children, flush, footer }) => (
  <div className="card">
    {(title || meta || actions) && (
      <div className="card__header">
        <div className="row gap-3">
          {title && <h3>{title}</h3>}
          {meta && <span className="meta">{meta}</span>}
        </div>
        {actions && <div className="row gap-2">{actions}</div>}
      </div>
    )}
    <div className={`card__body ${flush || !padded ? "card__body--flush" : ""}`}>{children}</div>
    {footer && <div className="card__header" style={{borderTop: "1px solid var(--border-2)", borderBottom: "none"}}>{footer}</div>}
  </div>
);

const Tag = ({ tone = "muted", children }) => (
  <span className={`tag ${tone !== "muted" ? `tag--${tone}` : ""}`}>{children}</span>
);

const Alert = ({ tone = "info", title, children, icon }) => (
  <div className={`alert alert--${tone}`}>
    <I name={icon || (tone === "err" ? "OctagonAlert" : tone === "warn" ? "AlertCircle" : "AlertCircle")} size={16} />
    <div>
      {title && <div className="alert__title">{title}</div>}
      <div>{children}</div>
    </div>
  </div>
);

const Metric = ({ label, value, hint }) => (
  <div className="metric">
    <span className="metric__label">{label}</span>
    <span className="metric__value">{value}</span>
    {hint && <span className="metric__hint">{hint}</span>}
  </div>
);

const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs">
    {tabs.map(t => (
      <button key={t.id} className={`tab ${value === t.id ? "is-active" : ""}`} onClick={() => onChange(t.id)}>
        {t.label}
        {t.count != null && <span style={{marginLeft: 6, color: "var(--fg-4)", fontVariantNumeric: "tabular-nums"}}>{t.count}</span>}
      </button>
    ))}
  </div>
);

const Empty = ({ icon = "Inbox", title, children }) => (
  <div className="empty">
    <I name={icon} size={28} />
    <h4>{title}</h4>
    {children && <p>{children}</p>}
  </div>
);

const ReadinessItem = ({ state, label, sub }) => (
  <div className="check-list__item">
    <div className={`check-list__icon check-list__icon--${state}`}>
      {state === "ok"   && <svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7" /></svg>}
      {state === "warn" && <svg viewBox="0 0 24 24"><path d="M12 8v5M12 17h.01" /></svg>}
      {state === "err"  && <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>}
    </div>
    <span className="check-list__label">{label}</span>
    {sub && <span className="check-list__sub">{sub}</span>}
  </div>
);

Object.assign(window, { Button, IconButton, StatusBadge, CountBadge, Card, Tag, Alert, Metric, Tabs, Empty, ReadinessItem });
