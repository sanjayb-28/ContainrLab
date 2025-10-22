from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(slots=True)
class JudgeFailure:
    code: str
    message: str
    hint: Optional[str] = None


@dataclass(slots=True)
class JudgeResult:
    passed: bool
    failures: List[JudgeFailure] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)
    notes: Dict[str, Any] = field(default_factory=dict)

    def add_failure(self, code: str, message: str, hint: Optional[str] = None) -> None:
        self.failures.append(JudgeFailure(code=code, message=message, hint=hint))
        self.passed = False
