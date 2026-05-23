"""Individual preflight checks.

Each check is a pure function `(client) -> list[Finding]`. They read from
the live DB and return findings; they do not write.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from padea_catering.ordering.generator import build_order_plan
from supabase import Client

from .framework import Finding


def _select(client: Client, table: str, columns: str = "*", **eq) -> list[dict]:
    q = client.table(table).select(columns)
    for k, v in eq.items():
        q = q.eq(k, v)
    return q.execute().data


def resolve_week_start(client: Client, week_start: date | None = None) -> date:
    """Default to the earliest session date in the current source pack."""
    if week_start is not None:
        return week_start
    sessions = _select(client, "sessions", "session_date")
    if not sessions:
        raise RuntimeError("No sessions exist; run ingestion before validation.")
    return min(date.fromisoformat(row["session_date"]) for row in sessions)


def _week_end(week_start: date) -> date:
    return week_start + timedelta(days=6)


def _filter_week_sessions(sessions: list[dict], week_start: date) -> list[dict]:
    week_end = _week_end(week_start)
    return [
        session
        for session in sessions
        if week_start <= date.fromisoformat(session["session_date"]) <= week_end
    ]


def check_caterer_minimums(client: Client, week_start: date | None = None) -> list[Finding]:
    """E-04: caterer weekly forecast meals vs minimum at each menu_item_count.

    Forecast = students enrolled in sessions served by this caterer this week,
    minus opted-out students, minus students whose year_level is excluded for
    their session, minus absent students.
    """
    findings: list[Finding] = []
    week_start = resolve_week_start(client, week_start)
    caterers = _select(client, "caterers", "id, name")
    minimums = _select(
        client, "caterer_weekly_minimums", "caterer_id, menu_item_count, minimum_meals"
    )
    sessions = _filter_week_sessions(
        _select(
            client,
            "sessions",
            "id, caterer_id, session_date, year_levels",
        ),
        week_start,
    )
    exclusions_rows = _select(client, "exclusions", "session_id, excluded_year_levels")
    enrolments = _select(client, "session_enrolments", "session_id, student_id")
    students = _select(client, "students", "id, year_level, opted_out, full_name")
    absences = _select(client, "absences", "session_id, student_id")
    dishes = {d["id"]: d for d in _select(client, "dishes", "id, caterer_id")}
    variants = {
        row["id"]: {**row, "caterer_id": dishes[row["dish_id"]]["caterer_id"]}
        for row in _select(client, "dish_variants", "id, dish_id")
        if row["dish_id"] in dishes
    }
    menu_offers = [
        row
        for row in _select(client, "menu_offers", "service_week_start, dish_variant_id")
        if row["service_week_start"] == week_start.isoformat()
    ]

    student_by_id = {s["id"]: s for s in students}
    excl_by_session = {e["session_id"]: set(e["excluded_year_levels"]) for e in exclusions_rows}
    absent_pairs = {(a["session_id"], a["student_id"]) for a in absences}

    # Count attending students per caterer.
    attending_by_caterer: dict[str, int] = defaultdict(int)
    for sess in sessions:
        excluded_years = excl_by_session.get(sess["id"], set())
        for enr in enrolments:
            if enr["session_id"] != sess["id"]:
                continue
            student = student_by_id.get(enr["student_id"])
            if student is None or student["opted_out"]:
                continue
            if student["year_level"] in excluded_years:
                continue
            if (sess["id"], student["id"]) in absent_pairs:
                continue
            attending_by_caterer[sess["caterer_id"]] += 1

    mins_by_caterer: dict[str, dict[int, int]] = defaultdict(dict)
    for m in minimums:
        mins_by_caterer[m["caterer_id"]][m["menu_item_count"]] = m["minimum_meals"]

    offered_count_by_caterer: dict[str, int] = defaultdict(int)
    for offer in menu_offers:
        variant = variants.get(offer["dish_variant_id"])
        if variant:
            offered_count_by_caterer[variant["caterer_id"]] += 1

    for c in caterers:
        forecast = attending_by_caterer.get(c["id"], 0)
        tiers = sorted(mins_by_caterer.get(c["id"], {}).items())
        if not tiers:
            findings.append(
                Finding(
                    severity="warning",
                    category="caterer_minimum",
                    message=f"{c['name']}: no minimums recorded, cannot validate forecast.",
                    related={"caterer_id": c["id"]},
                )
            )
            continue
        offered_count = offered_count_by_caterer.get(c["id"], 0)
        if offered_count == 0:
            continue  # check_menu_offers_exist reports the actionable error.
        tier_lookup = dict(tiers)
        if offered_count not in tier_lookup:
            findings.append(
                Finding(
                    severity="error",
                    category="caterer_minimum",
                    message=(
                        f"{c['name']}: {offered_count} offered options does not match "
                        f"any recorded minimum tier {sorted(tier_lookup)}."
                    ),
                    related={"caterer_id": c["id"], "offered_count": offered_count},
                )
            )
            continue

        min_count, min_meals = offered_count, tier_lookup[offered_count]
        if forecast < min_meals:
            shortfall = min_meals - forecast
            findings.append(
                Finding(
                    severity="error",
                    category="caterer_minimum",
                    message=(
                        f"{c['name']}: forecast {forecast} meals < minimum "
                        f"{min_meals} @ {min_count} items (shortfall {shortfall})."
                    ),
                    related={
                        "caterer_id": c["id"],
                        "forecast": forecast,
                        "tiers": dict(tiers),
                    },
                )
            )
        else:
            findings.append(
                Finding(
                    severity="info",
                    category="caterer_minimum",
                    message=(
                        f"{c['name']}: forecast {forecast} meals satisfies minimum "
                        f"{min_meals} @ {min_count} offered menu items."
                    ),
                    related={
                        "caterer_id": c["id"],
                        "forecast": forecast,
                        "offered_count": offered_count,
                        "tiers": dict(tiers),
                    },
                )
            )
    return findings


def check_missing_rooms(client: Client) -> list[Finding]:
    """E-16/D-12: building-only delivery locations are expected for this dataset."""
    _ = client
    return []


def check_multi_session_same_date(client: Client) -> list[Finding]:
    """D-05: a single student enrolled in more than one session on the same date.

    Should be empty in this dataset because the "Riley Turner" name collision
    is two distinct UUIDs at two different schools.
    """
    findings: list[Finding] = []
    enrolments = _select(client, "session_enrolments", "student_id, session_id")
    sessions = {s["id"]: s["session_date"] for s in _select(client, "sessions", "id, session_date")}
    students = {s["id"]: s["full_name"] for s in _select(client, "students", "id, full_name")}

    seen: dict[tuple[str, date], list[str]] = defaultdict(list)
    for e in enrolments:
        d = sessions.get(e["session_id"])
        if d is None:
            continue
        seen[(e["student_id"], d)].append(e["session_id"])
    for (student_id, d), session_ids in seen.items():
        if len(session_ids) > 1:
            findings.append(
                Finding(
                    severity="error",
                    category="multi_session_same_date",
                    message=(
                        f"Student {students.get(student_id, student_id)} is enrolled "
                        f"in {len(session_ids)} sessions on {d} — physically impossible."
                    ),
                    related={"student_id": student_id, "date": str(d), "session_ids": session_ids},
                )
            )
    return findings


def check_caterer_contact_emails(client: Client) -> list[Finding]:
    """E-09/D-11: report incomplete contacts, but do not flag synthetic webmail."""
    findings: list[Finding] = []
    contacts = _select(
        client,
        "caterer_contacts",
        "id, caterer_id, display_name, email, is_verified, cc_preference",
    )
    caterer_names = {c["id"]: c["name"] for c in _select(client, "caterers", "id, name")}
    for c in contacts:
        cname = caterer_names.get(c["caterer_id"], "?")
        if not c["email"]:
            findings.append(
                Finding(
                    severity="info",
                    category="missing_contact_email",
                    message=f"{cname}: contact {c['display_name']!r} has no email address.",
                    related={"contact_id": c["id"]},
                )
            )
        if not c["is_verified"]:
            findings.append(
                Finding(
                    severity="info",
                    category="unverified_contact",
                    message=f"{cname}: contact {c['display_name']!r} is not verified.",
                    related={"contact_id": c["id"]},
                )
            )
    return findings


def check_empty_sessions(client: Client) -> list[Finding]:
    """Every session should have ≥1 attending student after exclusions+absences+opt-out."""
    findings: list[Finding] = []
    sessions = _select(client, "sessions", "id, school_id, session_date, year_levels")
    exclusions_rows = _select(client, "exclusions", "session_id, excluded_year_levels")
    enrolments = _select(client, "session_enrolments", "session_id, student_id")
    students = {s["id"]: s for s in _select(client, "students", "id, year_level, opted_out")}
    absences = _select(client, "absences", "session_id, student_id")
    school_names = {
        s["id"]: s["canonical_name"] for s in _select(client, "schools", "id, canonical_name")
    }

    excl = {e["session_id"]: set(e["excluded_year_levels"]) for e in exclusions_rows}
    absent_pairs = {(a["session_id"], a["student_id"]) for a in absences}

    for sess in sessions:
        excluded_years = excl.get(sess["id"], set())
        attending = 0
        for e in enrolments:
            if e["session_id"] != sess["id"]:
                continue
            st = students.get(e["student_id"])
            if st is None or st["opted_out"]:
                continue
            if st["year_level"] in excluded_years:
                continue
            if (sess["id"], st["id"]) in absent_pairs:
                continue
            attending += 1
        school = school_names.get(sess["school_id"], "?")
        # A fully-cancelled session (every attending year level is in the
        # exclusion list) is expected to be empty — surface as info, not error.
        fully_cancelled = bool(excluded_years) and set(sess["year_levels"]).issubset(excluded_years)
        if attending == 0:
            if fully_cancelled:
                findings.append(
                    Finding(
                        severity="info",
                        category="empty_session",
                        message=(
                            f"{school} on {sess['session_date']}: fully cancelled "
                            f"(years {sorted(excluded_years)}) — no order needed."
                        ),
                        related={"session_id": sess["id"], "fully_cancelled": True},
                    )
                )
            else:
                findings.append(
                    Finding(
                        severity="error",
                        category="empty_session",
                        message=(
                            f"{school} on {sess['session_date']}: 0 attending students "
                            f"after absences/opt-out and no exclusion explains it — do not order."
                        ),
                        related={"session_id": sess["id"]},
                    )
                )
        elif attending < 5:
            findings.append(
                Finding(
                    severity="warning",
                    category="empty_session",
                    message=(
                        f"{school} on {sess['session_date']}: only {attending} "
                        f"attending students — operator should confirm."
                    ),
                    related={"session_id": sess["id"], "attending": attending},
                )
            )
    return findings


def check_dietary_warning_backlog(client: Client) -> list[Finding]:
    """Any pending student_dietary_warnings rows block ordering for those students."""
    findings: list[Finding] = []
    rows = _select(
        client, "student_dietary_warnings", "id, student_id, raw_value, status", status="pending"
    )
    if not rows:
        return findings
    student_names = {s["id"]: s["full_name"] for s in _select(client, "students", "id, full_name")}
    for r in rows:
        findings.append(
            Finding(
                severity="error",
                category="dietary_warning_pending",
                message=(
                    f"Student {student_names.get(r['student_id'], r['student_id'])}: "
                    f"unrecognised dietary text {r['raw_value']!r} — operator must "
                    f"resolve before ordering."
                ),
                related={"warning_id": r["id"], "student_id": r["student_id"]},
            )
        )
    return findings


def _active_caterer_ids_for_week(client: Client, week_start: date) -> set[str]:
    sessions = _filter_week_sessions(
        _select(client, "sessions", "id, caterer_id, year_levels, session_date"),
        week_start,
    )
    exclusions = {
        row["session_id"]: set(row["excluded_year_levels"])
        for row in _select(client, "exclusions", "session_id, excluded_year_levels")
    }
    active: set[str] = set()
    for session in sessions:
        excluded = exclusions.get(session["id"], set())
        fully_cancelled = bool(excluded) and set(session["year_levels"]).issubset(excluded)
        if not fully_cancelled:
            active.add(session["caterer_id"])
    return active


def check_menu_offers_exist(client: Client, week_start: date | None = None) -> list[Finding]:
    """Phase 2: every active caterer needs an operator-selected menu offer set."""
    findings: list[Finding] = []
    week_start = resolve_week_start(client, week_start)
    active_caterers = _active_caterer_ids_for_week(client, week_start)
    caterers = {row["id"]: row["name"] for row in _select(client, "caterers", "id, name")}
    dishes = {row["id"]: row for row in _select(client, "dishes", "id, caterer_id")}
    variants = {
        row["id"]: {**row, "caterer_id": dishes[row["dish_id"]]["caterer_id"]}
        for row in _select(client, "dish_variants", "id, dish_id")
        if row["dish_id"] in dishes
    }
    offers = [
        row
        for row in _select(client, "menu_offers", "service_week_start, dish_variant_id")
        if row["service_week_start"] == week_start.isoformat()
    ]
    offered_by_caterer: dict[str, set[str]] = defaultdict(set)
    for offer in offers:
        variant = variants.get(offer["dish_variant_id"])
        if variant:
            offered_by_caterer[variant["caterer_id"]].add(offer["dish_variant_id"])

    tier_counts: dict[str, set[int]] = defaultdict(set)
    for row in _select(client, "caterer_weekly_minimums", "caterer_id, menu_item_count"):
        tier_counts[row["caterer_id"]].add(row["menu_item_count"])

    for caterer_id in sorted(active_caterers, key=lambda cid: caterers.get(cid, cid)):
        offered_count = len(offered_by_caterer.get(caterer_id, set()))
        caterer_name = caterers.get(caterer_id, caterer_id)
        if offered_count == 0:
            findings.append(
                Finding(
                    severity="error",
                    category="menu_offers",
                    message=(f"{caterer_name}: no menu_offers for week {week_start.isoformat()}."),
                    related={"caterer_id": caterer_id, "week_start": week_start.isoformat()},
                )
            )
        elif offered_count not in tier_counts.get(caterer_id, set()):
            findings.append(
                Finding(
                    severity="error",
                    category="menu_offers",
                    message=(
                        f"{caterer_name}: {offered_count} offered options does not match "
                        f"minimum tiers {sorted(tier_counts.get(caterer_id, set()))}."
                    ),
                    related={
                        "caterer_id": caterer_id,
                        "week_start": week_start.isoformat(),
                        "offered_count": offered_count,
                    },
                )
            )
    return findings


def check_offered_dish_review_status(
    client: Client,
    week_start: date | None = None,
) -> list[Finding]:
    """D-08/D-09: offered variants should eventually be operator-reviewed."""
    findings: list[Finding] = []
    week_start = resolve_week_start(client, week_start)
    dishes = {
        row["id"]: row
        for row in _select(
            client,
            "dishes",
            "id, name",
        )
    }
    variants = {}
    for row in _select(
        client,
        "dish_variants",
        "id, dish_id, name, ingredient_flags_source, has_no_declared_tags",
    ):
        dish = dishes.get(row["dish_id"])
        if not dish:
            continue
        display_name = (
            dish["name"] if row["name"] == "Standard" else f"{dish['name']} - {row['name']}"
        )
        variants[row["id"]] = {**row, "display_name": display_name}
    offers = [
        row
        for row in _select(client, "menu_offers", "service_week_start, dish_variant_id")
        if row["service_week_start"] == week_start.isoformat()
    ]
    for offer in offers:
        variant = variants.get(offer["dish_variant_id"])
        if not variant:
            continue
        if variant["ingredient_flags_source"] != "operator_reviewed":
            findings.append(
                Finding(
                    severity="warning",
                    category="dish_review",
                    message=(
                        f"Offered option {variant['display_name']!r} has ingredient flags source "
                        f"{variant['ingredient_flags_source']!r}; operator review still required."
                    ),
                    related={
                        "dish_id": variant["dish_id"],
                        "dish_variant_id": offer["dish_variant_id"],
                        "week_start": week_start.isoformat(),
                        "has_no_declared_tags": variant["has_no_declared_tags"],
                    },
                )
            )
    return findings


def check_order_generation_readiness(
    client: Client,
    week_start: date | None = None,
) -> list[Finding]:
    """Run ordering in dry-run mode and surface blocking allocation issues."""
    week_start = resolve_week_start(client, week_start)
    plan = build_order_plan(client, week_start)
    findings: list[Finding] = []
    for issue in plan.issues:
        findings.append(
            Finding(
                severity=issue.severity,
                category="order_generation_readiness",
                message=issue.message,
                related={
                    "code": issue.code,
                    "session_id": issue.session_id,
                    "student_id": issue.student_id,
                    "dish_id": issue.dish_id,
                    "dish_variant_id": issue.dish_variant_id,
                    **(issue.details or {}),
                },
            )
        )
    return findings


BASE_CHECKS = (
    check_caterer_minimums,
    check_missing_rooms,
    check_multi_session_same_date,
    check_caterer_contact_emails,
    check_empty_sessions,
    check_dietary_warning_backlog,
)

PHASE_2_CHECKS = (
    check_menu_offers_exist,
    check_offered_dish_review_status,
    check_order_generation_readiness,
)


def run_all_checks(client: Client, week_start: date | None = None) -> list[Finding]:
    resolved_week_start = resolve_week_start(client, week_start)
    findings: list[Finding] = []
    findings.extend(check_caterer_minimums(client, resolved_week_start))
    for check in BASE_CHECKS[1:]:
        findings.extend(check(client))
    for check in PHASE_2_CHECKS:
        findings.extend(check(client, resolved_week_start))
    return findings


ALL_CHECKS = BASE_CHECKS + PHASE_2_CHECKS
