## Git Workflow

Use Git deliberately. The commit history should show clear engineering progress: requirements, schema, ingestion, ordering logic, validation, UI, and submission artifacts.

### Core Rules

- Keep `main` stable and runnable.
- Make small, coherent commits.
- Use descriptive commit messages.
- Check `git status` before every commit.
- Check `git diff` before staging large changes.
- Never commit secrets, virtual environments, caches, or local generated files.
- Never commit `.env`, `.env.local`, `web/.env*`, `.venv/`, `__pycache__/`, `.streamlit/secrets.toml`, `web/node_modules/`, `web/.next/`, `web/.vercel/`, or Supabase service-role keys.
- Do not rewrite Git history unless explicitly requested by the human operator.

### Normal Solo Workflow

For small, safe edits:

```bash
git status
git diff
git add .
git status
git commit -m "Describe the change clearly"
git push
````

Examples:

```bash
git commit -m "Add agent instructions and skill mirroring"
git commit -m "Document catering edge cases"
git commit -m "Add initial Supabase schema migrations"
git commit -m "Implement absence-aware order generation"
git commit -m "Add validation checks for dietary exclusions"
```

### Branch Workflow

Use a branch for non-trivial changes, especially schema changes, ingestion rewrites, ordering logic, or Next.js UI work.

```bash
git checkout -b short-descriptive-branch-name
```

Examples:

```bash
git checkout -b schema-design
git checkout -b ingestion-pipeline
git checkout -b order-generation
git checkout -b validation-preflight
git checkout -b web-scaffold
git checkout -b web-order-review
git checkout -b rls-policies
```

After changes:

```bash
git status
git diff
git add .
git commit -m "Describe the change clearly"
git push -u origin short-descriptive-branch-name
```

After the branch is merged into `main`:

```bash
git checkout main
git pull
git branch -d short-descriptive-branch-name
```

### Before Committing

Run the relevant checks for the part of the system you touched.

Python (`src/padea_catering/`, ingestion, ordering, validation):

```bash
uv run ruff format .
uv run ruff check .
uv run pytest
```

Next.js (`web/`):

```bash
pnpm --dir web lint
pnpm --dir web typecheck
pnpm --dir web test       # once a test suite exists
```

If tests are not yet available for the area you changed, say so in the commit message or update `docs/DECISIONS.md`.

Before committing, verify that generated or local-only files are not staged:

```bash
git status
```

Do not stage:

```text
.venv/
.env
.env.*
.streamlit/secrets.toml
__pycache__/
.pytest_cache/
.ruff_cache/
data/interim/
data/processed/
data/snapshots/
artifacts/exports/
tmp/

web/node_modules/
web/.next/
web/.turbo/
web/.vercel/
web/out/
web/.env
web/.env.*
web/types/supabase.generated.ts
```

### Raw Data Rule

For this private competition repository, `data/raw/` may be committed so the reviewer can reproduce the system from the provided source files.

Do not mutate files in `data/raw/`. Any parsed or transformed outputs must go into `data/interim/` or `data/processed/`.

### Agent Behaviour

When making code changes, agents should:

1. Inspect `git status` before editing.
2. Prefer small edits over broad rewrites.
3. Avoid unrelated formatting churn.
4. Update docs and tests with code changes.
5. Mention any files that should be reviewed carefully.
6. Never run destructive Git commands such as `git reset --hard`, `git clean -fd`, `git rebase`, or force-push unless explicitly instructed by the human operator.

### Good Commit Shape

A good commit should usually do one thing:

* Add a schema migration.
* Add one ingestion parser.
* Add one validation rule.
* Add one Next.js route, server action, or component.
* Add one Python operations action.
* Update one piece of documentation.
* Add tests for one edge case.

Avoid commits that mix unrelated changes, such as schema redesign, UI rewrites, and documentation cleanup all at once.