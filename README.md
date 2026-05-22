# Padea Catering System

Operational catering system for weekly school tutoring meal ordering.

Current stage: **variant-aware Menu Setup MVP**.

Run the temporary MVP UI:

```bash
uv run streamlit run app/menu_setup_mvp.py
```

Review generated orders:

```bash
uv run streamlit run app/order_review_mvp.py
```

The MVP is intentionally separate from the future final Streamlit app in `app/streamlit_app.py`.
It currently supports:

- creating concrete dish variants for customisable parent dishes
- selecting weekly menu offers by variant
- reviewing dietary and ingredient flags with operator metadata
- running validation and order-generation dry runs

The order review MVP currently supports:

- selecting a generated order run
- reviewing order lines, allocation summaries, contacts, and delivery notes
- preparing deterministic copy-ready caterer email drafts
- downloading draft text files

See `docs/current_stage.md` for the authoritative project status and next steps.
