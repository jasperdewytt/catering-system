"""Shared types for the preflight validation layer.

Findings are computed on demand against the live DB. Persistence to a
`session_validation_findings` table is deferred to a Phase 3 migration.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

Severity = Literal["info", "warning", "error"]


@dataclass
class Finding:
    severity: Severity
    category: str
    message: str
    related: dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationReport:
    findings: list[Finding] = field(default_factory=list)

    def add(self, *findings: Finding) -> None:
        self.findings.extend(findings)

    def by_severity(self, severity: Severity) -> list[Finding]:
        return [f for f in self.findings if f.severity == severity]

    def by_category(self) -> dict[str, list[Finding]]:
        out: dict[str, list[Finding]] = {}
        for f in self.findings:
            out.setdefault(f.category, []).append(f)
        return out

    @property
    def error_count(self) -> int:
        return len(self.by_severity("error"))

    @property
    def warning_count(self) -> int:
        return len(self.by_severity("warning"))

    @property
    def info_count(self) -> int:
        return len(self.by_severity("info"))
