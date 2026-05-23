/* Icons.jsx — inline Lucide-style stroke SVGs.
   Loaded as a global script; exports each Icon onto window. */

const Icon = ({ d, paths, size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {paths ? paths.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICONS = {
  Dashboard:    ["M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"],
  Calendar:     ["M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M16 2v4M8 2v4M3 10h18"],
  Utensils:     ["M3 11l3-8 3 8", "M6 21V11", "M21 15a2 2 0 0 1-4 0V3", "M14 8l4-4 4 4"],
  Shield:       ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M9 12l2 2 4-4"],
  Orders:       ["M4 4a2 2 0 0 1 2-2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", "M14 2v6h6", "M9 14h6M9 18h4"],
  Send:         ["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7z"],
  Building:     ["M3 21h18", "M5 21V8l4-4h6l4 4v13", "M9 21V12h6v9", "M10 8h.01M14 8h.01M10 11h.01M14 11h.01"],
  Users:        ["M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2", "M16 14h2a3 3 0 0 1 3 3v2"], // plus circles drawn separately
  History:      ["M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5", "M12 7v5l3 2"],
  Settings:     ["M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
  Check:        ["M20 6L9 17l-5-5"],
  CheckCircle:  ["M22 11.08V12a10 10 0 1 1-5.93-9.14", "M22 4L12 14.01l-3-3"],
  X:            ["M18 6L6 18M6 6l12 12"],
  Alert:        ["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"],
  AlertCircle:  ["M12 9v4", "M12 17h.01"], // circle drawn separately
  OctagonAlert: ["M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z", "M12 8v4", "M12 16h.01"],
  ChevronDown:  ["M6 9l6 6 6-6"],
  ChevronRight: ["M9 6l6 6-6 6"],
  ChevronLeft:  ["M15 6l-6 6 6 6"],
  ArrowRight:   ["M5 12h14", "M12 5l7 7-7 7"],
  Undo:         ["M9 14L4 9l5-5", "M4 9h11a5 5 0 0 1 5 5v6"],
  Edit:         ["M11 4H4v16h16v-7", "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"],
  Plus:         ["M12 5v14M5 12h14"],
  Filter:       ["M22 3H2l8 9.46V19l4 2v-8.54z"],
  Search:       ["M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.35-4.35"],
  Download:     ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  Copy:         ["M9 9h10v12H9z", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
  Eye:          ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  MoreH:        ["M12 12h.01M19 12h.01M5 12h.01"],
  ExternalLink: ["M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", "M15 3h6v6", "M10 14L21 3"],
  Clock:        ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 6v6l4 2"],
  Inbox:        ["M22 12h-6l-2 3h-4l-2-3H2", "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"],
  Mail:         ["M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z", "M22 6l-10 7L2 6"],
  Sparkles:     ["M9 3l1.5 4.5L15 9l-4.5 1.5L9 15l-1.5-4.5L3 9l4.5-1.5z", "M19 13l.8 2.4L22 16l-2.2.6L19 19l-.8-2.4L16 16l2.2-.6z"],
  Archive:      ["M21 8v13H3V8", "M1 3h22v5H1z", "M10 12h4"],
  Logout:       ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  ShieldOff:    ["M19.7 14a6.95 6.95 0 0 0 .3-2V5l-8-3-3.16 1.18", "M4.73 4.73L4 5v7c0 6 8 10 8 10a20.29 20.29 0 0 0 5.62-4.38", "M1 1l22 22"],
  Bell:         ["M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.73 21a2 2 0 0 1-3.46 0"],
  Globe:        ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M2 12h20", "M12 2a15 15 0 0 1 0 20", "M12 2a15 15 0 0 0 0 20"],
  Hash:         ["M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"],
};

// Some icons need extra elements (circles). Render specially.
const IconSpecial = ({ name, size = 16, ...props }) => {
  const base = { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
                 stroke: "currentColor", strokeWidth: 1.7,
                 strokeLinecap: "round", strokeLinejoin: "round", ...props };
  if (name === "AlertCircle") return (
    <svg {...base}><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
  );
  if (name === "Users") return (
    <svg {...base}><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/>
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <path d="M16 14h2a3 3 0 0 1 3 3v2"/></svg>
  );
  if (name === "CheckCircle") return (
    <svg {...base}><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>
  );
  if (name === "Clock") return (
    <svg {...base}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
  );
  if (name === "Globe") return (
    <svg {...base}><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
  );
  return null;
};

// Public component: <I name="Dashboard" size={16} />
const I = ({ name, size = 16, ...props }) => {
  const special = IconSpecial({ name, size, ...props });
  if (special) return special;
  const paths = ICONS[name];
  if (!paths) {
    console.warn("Unknown icon:", name);
    return null;
  }
  return <Icon paths={paths} size={size} {...props} />;
};

window.I = I;
