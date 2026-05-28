# Design Handoff

The Claude Design export has been fetched and extracted to:

`docs/design-handoff/`

This folder is historical visual reference material only. It is not the production Next.js app and should not be copied directly into `web/`; the production operator console now lives in `web/`.

## What To Read

Start with these files:

1. `docs/design-handoff/README.md`
2. `docs/design-handoff/chats/` - read the transcript before implementing any screen; this is where design intent and iteration history live.
3. `docs/design-handoff/project/README.md`
4. `docs/design-handoff/project/ui_kits/operator/README.md`

The main click-through prototype entry is:

`docs/design-handoff/project/ui_kits/operator/index.html`

Open that file in a browser to review the designed operator screens. It covers Dashboard, Menu setup, Order run detail, Caterer Emails, Audit, and Login as historical visual references.

## Design Sources

- Design tokens: `docs/design-handoff/project/colors_and_type.css`
- Operator UI kit styles: `docs/design-handoff/project/ui_kits/operator/ui-kit.css`
- Shared prototype components: `docs/design-handoff/project/ui_kits/operator/Primitives.jsx`
- App shell reference: `docs/design-handoff/project/ui_kits/operator/AppShell.jsx`
- Screen references: `docs/design-handoff/project/ui_kits/operator/screens/`
- Logo assets: `docs/design-handoff/project/assets/` and `docs/design-handoff/project/uploads/`

Use `lucide-react` for production icons. The prototype's `Icons.jsx` is a reference for intent only, not the complete or production icon set.

## Implementation Notes

For production changes, re-create any useful design detail with the project stack in `web/`: Next.js, TypeScript, Tailwind, shadcn/ui, Radix, Lucide, and Supabase SSR. Use the JSX files as visual references, not as production source.

Preserve these design rules:

- Keep the UI dense, calm, and operations-first.
- Use crimson sparingly for brand, primary actions, active navigation, and focus rings.
- Use the fixed status vocabulary: Ready, Unreviewed, Generated, Approved, Email ready, Blocked, Superseded.
- Use concrete safety language. Do not imply data has been fixed or sent unless the underlying audited action exists.
- Keep audit context near approvals, email preparation, overrides, and reopen actions.
- Do not duplicate Python-owned catering rules in the UI.

## Current Scope

This handoff documents the historical design system and prototype only. The implemented website in `web/` is the source of truth for submitted operator functionality.
