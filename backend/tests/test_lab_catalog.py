from __future__ import annotations

import sys
from pathlib import Path

import pytest  # type: ignore[import]

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.services.lab_catalog import LabCatalog  # type: ignore[import]


def _write_lab(root: Path, slug: str, title: str, summary: str) -> None:
    lab_dir = root / slug
    (lab_dir / "starter").mkdir(parents=True, exist_ok=True)
    readme = lab_dir / "README.md"
    readme.write_text(f"# {title}\n\n{summary}\n\nMore instructions.\n", encoding="utf-8")


def test_lab_catalog_lists_and_gets(tmp_path: Path) -> None:
    _write_lab(tmp_path, "lab1", "Lab One", "First lab summary")
    _write_lab(tmp_path, "lab2", "Lab Two", "Second lab summary")

    catalog = LabCatalog(root=tmp_path)
    labs = catalog.list()

    assert [lab.slug for lab in labs] == ["lab1", "lab2"]
    assert labs[0].title == "Lab One"
    assert labs[0].summary == "First lab summary"
    assert labs[0].has_starter is True

    detail = catalog.get("lab1")
    assert detail.readme.startswith("# Lab One")
    assert "More instructions." in detail.readme


def test_lab_catalog_missing_lab(tmp_path: Path) -> None:
    _write_lab(tmp_path, "lab1", "Lab One", "Summary")
    catalog = LabCatalog(root=tmp_path)

    with pytest.raises(FileNotFoundError):
        catalog.get("lab-does-not-exist")


def test_lab_catalog_missing_root(tmp_path: Path) -> None:
    missing_root = tmp_path / "ghost"
    with pytest.raises(FileNotFoundError):
        LabCatalog(root=missing_root)
