"""
Judging helper modules for ContainrLab labs.

Each lab exposes an evaluate(session_id, runner) coroutine that returns a JudgeResult.
The backend imports these helpers to orchestrate checks via the runner service.
"""

from .models import JudgeFailure, JudgeResult  # noqa: F401
