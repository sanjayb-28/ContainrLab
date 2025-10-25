from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable, List, Optional

_env_labs_root = os.getenv("LABS_ROOT")
if _env_labs_root:
    DEFAULT_LABS_ROOT = Path(_env_labs_root).resolve()
else:
    DEFAULT_LABS_ROOT = (Path(__file__).resolve().parents[2] / "labs").resolve()


@dataclass(slots=True)
class LabMetadata:
    slug: str
    title: str
    summary: Optional[str]
    has_starter: bool


@dataclass(slots=True)
class LabDetail(LabMetadata):
    description: str
    solution: str | None


class LabCatalog:
    """Discover labs from the repository filesystem."""

    def __init__(self, root: Path | None = None) -> None:
        self._root = (root or DEFAULT_LABS_ROOT).resolve()
        if not self._root.exists():
            raise FileNotFoundError(f"Labs root '{self._root}' does not exist")

    def list(self) -> List[LabMetadata]:
        labs: List[LabMetadata] = []
        for entry in sorted(self._root.iterdir(), key=lambda p: p.name):
            if not entry.is_dir():
                continue
            try:
                labs.append(self._load_metadata(entry))
            except FileNotFoundError:
                # Skip directories without the expected lab description
                continue
        return labs

    def get(self, slug: str) -> LabDetail:
        lab_dir = self._root / slug
        if not lab_dir.is_dir():
            raise FileNotFoundError(f"Lab '{slug}' not found")
        metadata = self._load_metadata(lab_dir)
        description_path = _resolve_lab_doc(lab_dir)
        description = _read_file(description_path)
        solution_path = lab_dir / "solution.md"
        solution = _read_file(solution_path) if solution_path.is_file() else None
        return LabDetail(
            slug=metadata.slug,
            title=metadata.title,
            summary=metadata.summary,
            has_starter=metadata.has_starter,
            description=description,
            solution=solution,
        )

    def _load_metadata(self, lab_dir: Path) -> LabMetadata:
        doc_path = _resolve_lab_doc(lab_dir)
        title, summary = _parse_lab_doc(doc_path)
        starter_dir = lab_dir / "starter"
        return LabMetadata(
            slug=lab_dir.name,
            title=title or lab_dir.name,
            summary=summary,
            has_starter=starter_dir.is_dir(),
        )


@lru_cache
def get_lab_catalog() -> LabCatalog:
    return LabCatalog()


def _resolve_lab_doc(lab_dir: Path) -> Path:
    for candidate in ("description.md", "README.md"):
        doc_path = lab_dir / candidate
        if doc_path.is_file():
            return doc_path
    raise FileNotFoundError(f"Expected description.md or README.md in '{lab_dir}'")


def _parse_lab_doc(path: Path) -> tuple[str | None, str | None]:
    content = _read_file(path)
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    title: str | None = None
    summary: str | None = None
    for line in lines:
        if title is None and line.startswith("#"):
            title = line.lstrip("#").strip()
            continue
        if summary is None and not line.startswith("#"):
            summary = line
            break
    return title, summary


def _read_file(path: Path) -> str:
    if not path.is_file():
        raise FileNotFoundError(f"Expected file at '{path}'")
    return path.read_text(encoding="utf-8")
