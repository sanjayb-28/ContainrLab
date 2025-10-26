from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from typing import List, Optional, Sequence

from .lab_catalog import LabCatalog, LabDetail
from .runner_client import RunnerClient

logger = logging.getLogger("containrlab.agent.context")

WORKSPACE_ROOT = "/workspace"
MAX_TREE_LINES = 40
MAX_SNAPSHOT_FILES = 8
MAX_FILE_CHARS = 1500
MAX_TOTAL_FILE_CHARS = 6000


@dataclass(slots=True)
class WorkspaceSnippet:
    path: str
    content: str


@dataclass(slots=True)
class AgentContextSnapshot:
    lab_detail: Optional[LabDetail]
    workspace_tree: Sequence[str]
    workspace_files: Sequence[WorkspaceSnippet]

    def render(self) -> str | None:
        sections: List[str] = []

        if self.lab_detail:
            detail_lines: List[str] = ["Lab details:"]
            if self.lab_detail.title:
                detail_lines.append(f"Title: {self.lab_detail.title}")
            if self.lab_detail.summary:
                detail_lines.append(f"Summary: {self.lab_detail.summary}")
            if self.lab_detail.solution:
                solution = _truncate(self.lab_detail.solution, 1500)
                detail_lines.append("Solution excerpt:\n" + solution)
            sections.append("\n".join(detail_lines))

        if self.workspace_tree or self.workspace_files:
            tree_section: List[str] = ["Workspace snapshot:"]
            if self.workspace_tree:
                tree_section.append("Tree:")
                tree_section.extend(f"  {line}" for line in self.workspace_tree)
            if self.workspace_files:
                tree_section.append("Files:")
                for snippet in self.workspace_files:
                    tree_section.append(f"--- {snippet.path} ---")
                    tree_section.append(snippet.content)
            sections.append("\n".join(tree_section))

        if not sections:
            return None

        return "\n\n".join(sections)


async def build_agent_context(
    *,
    session_id: str,
    runner: RunnerClient,
    lab_slug: str | None,
    catalog: LabCatalog,
) -> tuple[str | None, str | None]:
    """Assemble lab and workspace context for Gemini prompts."""

    lab_detail: LabDetail | None = None
    resolved_slug = lab_slug
    if lab_slug:
        try:
            lab_detail = catalog.get(lab_slug)
        except FileNotFoundError:
            logger.warning("Lab '%s' not found while building agent context", lab_slug)

    tree_lines: List[str] = []
    file_snippets: List[WorkspaceSnippet] = []

    try:
        await _populate_workspace_snapshot(
            runner,
            session_id,
            tree_lines,
            file_snippets,
        )
    except Exception as exc:  # pragma: no cover - defensive safeguard
        logger.warning("Failed to build workspace snapshot: %s", exc)

    snapshot = AgentContextSnapshot(lab_detail=lab_detail, workspace_tree=tree_lines, workspace_files=file_snippets)
    context_text = snapshot.render()
    if lab_detail and not resolved_slug:
        resolved_slug = lab_detail.slug
    return resolved_slug, context_text


async def _populate_workspace_snapshot(
    runner: RunnerClient,
    session_id: str,
    tree_lines: List[str],
    file_snippets: List[WorkspaceSnippet],
) -> None:
    pending_dirs: list[tuple[str, int]] = [(WORKSPACE_ROOT, 0)]
    total_file_chars = 0

    while pending_dirs and len(tree_lines) < MAX_TREE_LINES:
        current_path, depth = pending_dirs.pop(0)
        listing = await runner.list_path(session_id, None if current_path == WORKSPACE_ROOT else current_path)
        entries = listing.get("entries") or []
        sorted_entries = sorted(
            (entry for entry in entries if isinstance(entry, dict)),
            key=lambda e: (not e.get("is_dir", False), e.get("name", "")),
        )

        for entry in sorted_entries:
            name = entry.get("name") or ""
            entry_path = entry.get("path") or ""
            is_dir = bool(entry.get("is_dir"))
            size = entry.get("size")
            size_info = f" ({size} bytes)" if isinstance(size, int) else ""
            indent = "  " * depth
            if is_dir:
                tree_lines.append(f"{indent}- {name}/")
                if depth + 1 < 3 and len(tree_lines) < MAX_TREE_LINES:
                    pending_dirs.append((entry_path, depth + 1))
            else:
                tree_lines.append(f"{indent}- {name}{size_info}")
                if len(file_snippets) >= MAX_SNAPSHOT_FILES or total_file_chars >= MAX_TOTAL_FILE_CHARS:
                    continue
                content = await _read_file_text(runner, session_id, entry_path)
                if content is None:
                    continue
                trimmed = _truncate(content, MAX_FILE_CHARS)
                total_file_chars += len(trimmed)
                file_snippets.append(WorkspaceSnippet(path=entry_path or name, content=trimmed))


async def _read_file_text(runner: RunnerClient, session_id: str, path: str) -> str | None:
    if not path:
        return None
    try:
        payload = await runner.read_file(session_id, path)
    except Exception as exc:  # pragma: no cover - runner access issues are logged upstream
        logger.debug("Unable to read file '%s': %s", path, exc)
        return None
    content_b64 = payload.get("content")
    if not isinstance(content_b64, str):
        return None
    try:
        raw_bytes = base64.b64decode(content_b64)
    except (ValueError, TypeError):
        return None
    try:
        return raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return None


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 20] + "\n... (truncated)"
