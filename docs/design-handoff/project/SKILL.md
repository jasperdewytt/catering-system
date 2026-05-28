---
name: padea-design
description: Use this historical visual-reference skill to generate well-branded interfaces and assets for Padea Education's internal catering operations console. Production changes must align with the implemented Next.js app in web/.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (static references, slide decks for ops team
reviews, etc.), copy the relevant assets out of `assets/`, link
`colors_and_type.css`, and reuse the components and patterns from
`ui_kits/operator/`. Create static HTML files for the user to view.

If working on production code (Next.js + Supabase + shadcn/ui), copy the CSS
variables out of `colors_and_type.css`, read the README sections on **CONTENT
FUNDAMENTALS**, **VISUAL FOUNDATIONS**, and **ICONOGRAPHY** to internalise the
voice and visual rules, and use the JSX components in `ui_kits/operator/` as
visual reference — re-implement them with real Tailwind/shadcn primitives
rather than copying directly. The status vocabulary is fixed (`Ready`,
`Unreviewed`, `Generated`, `Approved`, `Email ready`, `Blocked`, `Superseded`)
— treat it as canon, do not invent synonyms.

If the user invokes this skill without other guidance, ask which operator
workflow they want to refine and whether the output is a visual reference or a
production `web/` change.
