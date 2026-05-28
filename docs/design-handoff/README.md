# CODING AGENTS: READ THIS FIRST

This is a **historical handoff bundle** from Claude Design (claude.ai/design).

A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported this bundle as visual reference. The production operator console now lives in `web/`.

## What you should do — IMPORTANT

**Read the chat transcripts first.** There are 1 chat transcript(s) in `padea-catering-ops-design-system/chats/`. The transcripts show the full back-and-forth between the user and the design assistant — they tell you **what the user actually wants** and **where they landed** after iterating. Don't skip them. The final HTML files are the output, but the chat is where the intent lives.

**Find the primary design file under `padea-catering-ops-design-system/project/` and read it top to bottom.** The chat transcripts will tell you which file the user was last iterating on. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, treat `web/` and the project docs as the source of truth before using this historical reference.**

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `padea-catering-ops-design-system/README.md` — this file
- `padea-catering-ops-design-system/chats/` — conversation transcripts (read these!)
- `padea-catering-ops-design-system/project/` — the `Padea Catering Ops Design System` project files (HTML prototypes, assets, components)
