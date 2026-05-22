"""Individual preflight checks.

Each check is a pure function `(client) -> list[Finding]`. They read from
the live DB and return findings; they do not write.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date

from supabase import Client

from .framework import Finding


def _select(client: Client, table: str, columns: str = "*", **eq) -> list[dict]:
    q = client.table(table).select(columns)
    for k, v in eq.items():
        q = q.eq(k, v)
    return q.execute().data


def check_caterer_minimums(client: Client) -> list[Finding]:
    """E-04: caterer weekly forecast meals vs minimum at each menu_item_count.

    Forecast = students enrolled in sessions served by this caterer this week,
    minus opted-out students, minus students whose year_level is excluded for
    their session, minus absent students.
    """
    findings: list[Finding] = []
    caterers = _select(client, "caterers", "id, name")
    minimums = _select(
        client, "caterer_weekly_minimums", "caterer_id, menu_item_count, minimum_meals"
    )
    sessions = _select(
        client,
        "sessions",
        "id, caterer_id, session_date, year_levels",
    )
    exclusions_rows = _select(client, "exclusions", "session_id, excluded_year_levels")
    enrolments = _select(client, "session_enrolments", "session_id, student_id")
    students = _select(client, "students", "id, year_level, opted_out, full_name")
    absences = _select(client, "absences", "session_id, student_id")

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
        min_count, min_meals = tiers[0]  # lowest tier
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
            # Find the highest tier that the forecast still satisfies.
            achievable = [k for k, v in tiers if forecast >= v]
            findings.append(
                Finding(
                    severity="info",
                    category="caterer_minimum",
                    message=(
                        f"{c['name']}: forecast {forecast} meals, satisfies minimums "
                        f"up to {max(achievable)} menu items."
                    ),
                    related={
                        "caterer_id": c["id"],
                        "forecast": forecast,
                        "tiers": dict(tiers),
                    },
                )
            )
    return findings


def check_missing_rooms(client: Client) -> list[Finding]:
    """E-16: sessions with a building but no room number."""
    findings: list[Finding] = []
    sessions = _select(client, "sessions", "id, school_id, session_date, building, room")
    school_names = {
        s["id"]: s["canonical_name"] for s in _select(client, "schools", "id, canonical_name")
    }
    for sess in sessions:
        if sess["building"] and not sess.get("room"):
            findings.append(
                Finding(
                    severity="warning",
                    category="missing_room",
                    message=(
                        f"{school_names.get(sess['school_id'], '?')} "
                        f"on {sess['session_date']}: building "
                        f"{sess['building']!r} has no room number — "
                        f"include manager mobile in the order email."
                    ),
                    related={"session_id": sess["id"]},
                )
            )
    return findings


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
    """E-09: free webmail addresses and unverified contacts."""
    findings: list[Finding] = []
    contacts = _select(
        client,
        "caterer_contacts",
        "id, caterer_id, display_name, email, is_verified, cc_preference",
    )
    caterer_names = {c["id"]: c["name"] for c in _select(client, "caterers", "id, name")}
    for c in contacts:
        cname = caterer_names.get(c["caterer_id"], "?")
        if c["email"]:
            domain = c["email"].split("@")[-1].lower() if "@" in c["email"] else ""
            if domain in ("gmail.com", "outlook.com", "yahoo.com", "hotmail.com"):
                findings.append(
                    Finding(
                        severity="warning",
                        category="suspicious_email",
                        message=(
                            f"{cname} contact {c['display_name']!r} uses free webmail "
                            f"{c['email']} — operator must confirm before sending."
                        ),
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


ALL_CHECKS = (
    check_caterer_minimums,
    check_missing_rooms,
    check_multi_session_same_date,
    check_caterer_contact_emails,
    check_empty_sessions,
    check_dietary_warning_backlog,
)
