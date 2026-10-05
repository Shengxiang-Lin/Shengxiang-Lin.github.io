#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

import fitz
import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PROFILE_PATH = ROOT / "_data" / "profile.yml"
OUTPUT_ROOT = ROOT / "assets" / "images" / "awards"
MAX_SIDE = 1800
WEBP_QUALITY = 84
RENDER_SCALE = 2.0


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value or "award"


def source_path_from_url(url: str) -> Path | None:
    parsed = urlparse(url)
    path = unquote(parsed.path).lstrip("/")
    if not path.lower().endswith(".pdf"):
        return None
    source = ROOT / path
    try:
        source.relative_to(ROOT / "assets" / "cv")
    except ValueError:
        return None
    return source


def render_pdf(pdf_path: Path, output_dir: Path) -> list[str]:
    document = fitz.open(pdf_path)
    pages: list[str] = []

    for page_index, page in enumerate(document):
        pixmap = page.get_pixmap(matrix=fitz.Matrix(RENDER_SCALE, RENDER_SCALE), alpha=False)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)

        longest_side = max(image.size)
        if longest_side > MAX_SIDE:
            ratio = MAX_SIDE / float(longest_side)
            resized = (
                max(1, round(image.width * ratio)),
                max(1, round(image.height * ratio)),
            )
            image = image.resize(resized, Image.Resampling.LANCZOS)

        page_name = f"page-{page_index + 1:02d}.webp"
        page_path = output_dir / page_name
        image.save(page_path, "WEBP", quality=WEBP_QUALITY, method=6)
        relative = page_path.relative_to(ROOT).as_posix()
        pages.append("/" + relative)

    document.close()
    return pages


def main() -> None:
    with PROFILE_PATH.open("r", encoding="utf-8") as handle:
        profile = yaml.safe_load(handle) or {}

    awards = profile.get("awards") or []
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    # Rebuild the generated preview directory so removed or renamed awards do not leave stale pages.
    for child in OUTPUT_ROOT.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
        elif child.name != "manifest.json":
            child.unlink()

    manifest: dict[str, object] = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "awards": {},
    }
    manifest_awards: dict[str, object] = manifest["awards"]  # type: ignore[assignment]

    rendered_count = 0
    page_count = 0
    used_slugs: set[str] = set()

    for index, award in enumerate(awards, start=1):
        url = str(award.get("url") or "").strip()
        if not url:
            continue

        pdf_path = source_path_from_url(url)
        if pdf_path is None:
            print(f"[skip] award {index}: unsupported source URL: {url}")
            continue
        if not pdf_path.exists():
            print(f"[warn] award {index}: source PDF not found: {pdf_path.relative_to(ROOT)}")
            continue

        base_slug = slugify(pdf_path.stem)
        slug = base_slug
        suffix = 2
        while slug in used_slugs:
            slug = f"{base_slug}-{suffix}"
            suffix += 1
        used_slugs.add(slug)

        output_dir = OUTPUT_ROOT / slug
        output_dir.mkdir(parents=True, exist_ok=True)
        pages = render_pdf(pdf_path, output_dir)
        if not pages:
            print(f"[warn] award {index}: no pages rendered: {pdf_path.relative_to(ROOT)}")
            shutil.rmtree(output_dir, ignore_errors=True)
            continue

        manifest_awards[url] = {
            "pages": pages,
            "page_count": len(pages),
        }
        rendered_count += 1
        page_count += len(pages)
        print(f"[ok] {pdf_path.name}: {len(pages)} page(s) -> {slug}/")

    manifest_path = OUTPUT_ROOT / "manifest.json"
    with manifest_path.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(f"Rendered {rendered_count} award PDF(s), {page_count} page(s) total.")
    print(f"Manifest: {manifest_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
