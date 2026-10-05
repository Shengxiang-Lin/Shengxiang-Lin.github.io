#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PROFILE_PATH = ROOT / "_data" / "profile.yml"
OUTPUT_ROOT = ROOT / "assets" / "images" / "awards"
MAX_SIDE = 1800
WEBP_QUALITY = 84
JPEG_QUALITY = 92


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


def numeric_page_key(path: Path) -> tuple[int, str]:
    match = re.search(r"-(\d+)$", path.stem)
    return (int(match.group(1)) if match else 0, path.name)


def render_pdf(pdf_path: Path, output_dir: Path) -> list[str]:
    """Render every PDF page with Poppler, then encode optimized WebP previews.

    Poppler is used instead of PyMuPDF because a few certificate PDFs contain
    extremely large embedded raster images. MuPDF may refuse to decode those
    images ("Overly large image") and silently produce an empty-looking page.
    Rendering directly to a bounded pixel size also keeps memory use predictable.
    """
    pages: list[str] = []

    with tempfile.TemporaryDirectory(prefix="award-preview-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        prefix = temp_dir / "page"

        command = [
            "pdftoppm",
            "-jpeg",
            "-jpegopt",
            f"quality={JPEG_QUALITY}",
            "-scale-to",
            str(MAX_SIDE),
            str(pdf_path),
            str(prefix),
        ]
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            details = (result.stderr or result.stdout or "unknown Poppler error").strip()
            raise RuntimeError(f"pdftoppm failed for {pdf_path.name}: {details}")

        raster_pages = sorted(temp_dir.glob("page-*.jpg"), key=numeric_page_key)
        if not raster_pages:
            raise RuntimeError(f"pdftoppm produced no pages for {pdf_path.name}")

        for page_index, raster_path in enumerate(raster_pages, start=1):
            with Image.open(raster_path) as source_image:
                image = source_image.convert("RGB")

                longest_side = max(image.size)
                if longest_side > MAX_SIDE:
                    ratio = MAX_SIDE / float(longest_side)
                    resized = (
                        max(1, round(image.width * ratio)),
                        max(1, round(image.height * ratio)),
                    )
                    image = image.resize(resized, Image.Resampling.LANCZOS)

                page_name = f"page-{page_index:02d}.webp"
                page_path = output_dir / page_name
                image.save(page_path, "WEBP", quality=WEBP_QUALITY, method=6)

            relative = page_path.relative_to(ROOT).as_posix()
            pages.append("/" + relative)

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

        try:
            pages = render_pdf(pdf_path, output_dir)
        except Exception as error:
            print(f"[error] award {index}: {error}")
            shutil.rmtree(output_dir, ignore_errors=True)
            continue

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
