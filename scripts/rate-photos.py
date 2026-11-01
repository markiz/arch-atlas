#!/usr/bin/env python3
"""Compute the deterministic 0–100 rating for every stored photo sidecar.

The rating is a documentation score, not an aesthetic judgement. It is built
from objective inputs only:

* stored pixel dimensions;
* visual tags assigned by the one-pass review;
* a fixed grayscale analysis of the stored WebP (mean, contrast and p90).

A perfect score is a high-resolution, level, clean daytime facade photograph
with no quality flags. Night shots and dark frames are capped so that a frame
where little is visible cannot score high. The script is idempotent and only
rewrites a sidecar when its ``rating`` differs.

Usage:
  python3 scripts/rate-photos.py
  python3 scripts/rate-photos.py --check
  python3 scripts/rate-photos.py --dry-run
  python3 scripts/rate-photos.py --explain <sha256-prefix>
  python3 scripts/rate-photos.py --report work/photo-research/rating-report.json
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

from atlas_source import PHOTOS_DIR, ROOT, photo_metadata_path
from progress import Progress

HIGH_RATING = 50
RESOLUTION_MAX = 30
FACADE_MAX = 35
LIGHTING_MAX = 25
FRAMING_MAX = 10
BASE_MAX = RESOLUTION_MAX + FACADE_MAX + LIGHTING_MAX + FRAMING_MAX
# A separate smooth penalty replaces the binary low-resolution tag weight:
# at 800 px and wider there is no penalty; below 800 px the final score keeps
# a linearly growing share, down to 50% at width 0.
LOW_RESOLUTION_THRESHOLD = 800
LOW_RESOLUTION_MAX_PENALTY = 0.5

# Multiplicative penalties. They are deliberately larger than ordinary
# composition differences: a photo with several technical defects should not
# reach the top of a gallery merely because it is large.
# `low-resolution` stays in the taxonomy for search/filtering but has an empty
# weight; resolution is handled by `resolution_factor` instead.
PENALTIES: dict[str, float] = {
    'blurry': 0.35,
    'dark': 0.35,
    'low-resolution': 0.0,
    'subject-far': 0.22,
    'tilted': 0.18,
    'foreground-distraction': 0.18,
    'occluded': 0.18,
    'cluttered': 0.18,
    'nighttime': 0.08,
    'construction': 0.10,
    'scaffolding': 0.10,
    'multiple-buildings': 0.08,
    'car': 0.03,
    'people': 0.03,
    'tree': 0.02,
    'street-lamp': 0.02,
    'sign': 0.02,
    'fence-wall': 0.02,
}

ARCHITECTURAL_TAGS = frozenset({
    'window', 'balcony', 'arch', 'door', 'column', 'dome', 'tower', 'roof',
    'shopfront',
})


def round_half_up(value: float) -> int:
    """Avoid Python's bankers rounding at exact .5 boundaries."""
    return int(math.floor(value + 0.5))


def read_metadata(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict):
        raise ValueError('metadata must be a JSON object')
    return value


def write_metadata(path: Path, metadata: dict[str, Any]) -> None:
    temporary = path.with_name(f'.{path.name}.{uuid.uuid4().hex}.tmp')
    temporary.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    temporary.replace(path)


def image_stats(path: Path) -> tuple[float, float, int, int, int]:
    """Return mean, standard deviation and p10/p50/p90 of a grayscale sample."""
    with Image.open(path) as source:
        image = ImageOps.grayscale(source)
        image.thumbnail((256, 256), Image.Resampling.BILINEAR)
        histogram = image.histogram()
    total = sum(histogram)
    if not total:
        return 0.0, 0.0, 0, 0, 0
    mean = sum(index * count for index, count in enumerate(histogram)) / total
    variance = sum(
        (index - mean) ** 2 * count for index, count in enumerate(histogram)
    ) / total
    standard_deviation = math.sqrt(variance)

    def quantile(fraction: float) -> int:
        target = total * fraction
        accumulated = 0
        for index, count in enumerate(histogram):
            accumulated += count
            if accumulated >= target:
                return index
        return 255

    return mean, standard_deviation, quantile(0.10), quantile(0.50), quantile(0.90)


def resolution_score(width: int, height: int) -> int:
    megapixels = width * height / 1_000_000
    if width >= 1920 and megapixels >= 2.0:
        return RESOLUTION_MAX
    if width >= 1280 and megapixels >= 1.0:
        return 26
    if width >= 960 and megapixels >= 0.7:
        return 22
    if width >= 800 and megapixels >= 0.48:
        return 16
    if width >= 640 and megapixels >= 0.3:
        return 8
    return 0


def facade_score(tags: set[str]) -> int:
    if 'interior' in tags:
        cap = 6
    elif 'detail' in tags:
        cap = 10
    elif 'panorama' in tags or 'aerial' in tags:
        cap = 12
    else:
        cap = FACADE_MAX

    score = 0
    if 'facade' in tags:
        score = 26
        if 'street' in tags or 'courtyard' in tags:
            score += 4
        if tags & ARCHITECTURAL_TAGS:
            score += 5
    if 'multiple-buildings' in tags:
        score -= 6
    if 'construction' in tags or 'scaffolding' in tags:
        score -= 5
    if 'ruin' in tags:
        score -= 2
    return max(0, min(score, cap, FACADE_MAX))


def lighting_score(
    mean: float,
    standard_deviation: float,
    p90: int,
    *,
    nighttime: bool,
    dark: bool,
) -> int:
    if mean < 20 or p90 < 40:
        score = 0
    elif mean < 35 or p90 < 60:
        score = 4
    elif mean < 55:
        score = 10
    elif mean < 75:
        score = 16
    elif mean <= 190:
        score = LIGHTING_MAX
    elif mean <= 225:
        score = 18
    elif mean <= 240:
        score = 8
    else:
        score = 2

    if standard_deviation < 15:
        score -= 8
    elif standard_deviation < 25:
        score -= 4
    elif standard_deviation > 95:
        score -= 2

    if nighttime:
        score = min(score, 12)
        if mean < 50:
            score = min(score, 6)
        if mean < 35:
            score = 0
    if dark:
        score = min(score, 4)
    return max(0, min(score, LIGHTING_MAX))


def framing_score(width: int, height: int) -> int:
    ratio = width / height
    if 1.2 <= ratio <= 1.8:
        return 10
    if 1.0 <= ratio < 1.2 or 1.8 < ratio <= 2.2:
        return 7
    if 0.8 <= ratio < 1.0 or 2.2 < ratio <= 2.8:
        return 4
    return 2


def quality_factor(tags: set[str]) -> tuple[float, float]:
    penalty = sum(value for tag, value in PENALTIES.items() if tag in tags)
    penalty = min(penalty, 0.85)
    return max(0.15, 1.0 - penalty), penalty


def resolution_factor(width: int) -> float:
    """Linear resolution factor: 1.0 at >=800 px, 0.5 at width 0."""
    if width >= LOW_RESOLUTION_THRESHOLD:
        return 1.0
    fraction = max(0.0, width / LOW_RESOLUTION_THRESHOLD)
    return 1.0 - LOW_RESOLUTION_MAX_PENALTY * (1.0 - fraction)


def visibility_cap(
    mean: float,
    p90: int,
    *,
    nighttime: bool,
    dark: bool,
) -> int:
    cap = 100
    if dark:
        cap = min(cap, 25)
    if mean < 25 or p90 < 40:
        cap = min(cap, 15)
    elif mean < 35 or p90 < 55:
        cap = min(cap, 30)
    if nighttime and mean < 50:
        cap = min(cap, 45)
    if nighttime and p90 < 70:
        cap = min(cap, 40)
    return cap


def rate_photo(
    metadata: dict[str, Any],
    stats: tuple[float, float, int, int, int],
) -> tuple[int, dict[str, Any]]:
    width = metadata.get('width')
    height = metadata.get('height')
    tags_value = metadata.get('visualTags')
    if not isinstance(width, int) or isinstance(width, bool) or width <= 0:
        raise ValueError('width must be a positive integer')
    if not isinstance(height, int) or isinstance(height, bool) or height <= 0:
        raise ValueError('height must be a positive integer')
    if not isinstance(tags_value, list) or not all(
        isinstance(tag, str) and tag.strip() for tag in tags_value
    ):
        raise ValueError('visualTags must be a non-empty array of strings')

    tags = set(tags_value)
    mean, standard_deviation, p10, p50, p90 = stats
    resolution = resolution_score(width, height)
    facade = facade_score(tags)
    lighting = lighting_score(
        mean,
        standard_deviation,
        p90,
        nighttime='nighttime' in tags,
        dark='dark' in tags,
    )
    framing = framing_score(width, height)
    base = resolution + facade + lighting + framing
    factor, penalty = quality_factor(tags)
    size_factor = resolution_factor(width)
    cap = visibility_cap(
        mean,
        p90,
        nighttime='nighttime' in tags,
        dark='dark' in tags,
    )
    rating = min(BASE_MAX, round_half_up(base * factor * size_factor), cap)
    breakdown = {
        'resolution': resolution,
        'facade': facade,
        'lighting': lighting,
        'framing': framing,
        'base': base,
        'penalty': round(penalty, 2),
        'qualityFactor': round(factor, 2),
        'resolutionFactor': round(size_factor, 3),
        'cap': cap,
        'mean': round(mean, 1),
        'stdDev': round(standard_deviation, 1),
        'p10': p10,
        'p50': p50,
        'p90': p90,
    }
    return rating, breakdown


def distribution(values: list[int]) -> dict[str, int]:
    return {
        'under50': sum(value < 50 for value in values),
        '50to69': sum(50 <= value <= 69 for value in values),
        '70to84': sum(70 <= value <= 84 for value in values),
        '85to100': sum(value >= 85 for value in values),
        'perfect': sum(value == 100 for value in values),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--city', default='tbilisi')
    parser.add_argument('--dry-run', action='store_true', help='compute without writing')
    parser.add_argument('--check', action='store_true', help='fail if any stored rating is stale or missing')
    parser.add_argument('--explain', metavar='PREFIX', help='print the breakdown for matching photo ids')
    parser.add_argument('--report', type=Path, help='write a JSON report with every rating and its components')
    args = parser.parse_args()
    if args.dry_run and args.check:
        parser.error('--dry-run and --check are mutually exclusive')

    directory = PHOTOS_DIR / args.city
    images = sorted(directory.glob('*.webp'))
    if not images:
        print(f'No images in {directory.relative_to(ROOT)}', file=sys.stderr)
        return 1

    if args.explain:
        matches = [path for path in images if path.stem.startswith(args.explain)]
        if not matches:
            print(f'No photo matches {args.explain!r}', file=sys.stderr)
            return 1
        for path in matches:
            sidecar = photo_metadata_path(path.stem, args.city)
            metadata = read_metadata(sidecar)
            stats = image_stats(path)
            rating, breakdown = rate_photo(metadata, stats)
            print(json.dumps({
                'id': path.stem,
                'rating': rating,
                'storedRating': metadata.get('rating'),
                'width': metadata.get('width'),
                'height': metadata.get('height'),
                'tags': sorted(metadata.get('visualTags') or []),
                'components': breakdown,
            }, ensure_ascii=False, indent=2))
        return 0

    progress = Progress(len(images), 'rate photos')
    progress.start(f'{len(images)} images in data/photos/{args.city}')
    started = time.monotonic()
    changed = unchanged = errors = missing = 0
    ratings: list[int] = []
    report_photos: list[dict[str, Any]] = []

    for path in images:
        photo_id = path.stem
        label = photo_id[:12]
        sidecar = photo_metadata_path(photo_id, args.city)
        try:
            if not sidecar.exists():
                missing += 1
                print(f'{label}: metadata sidecar is missing', file=sys.stderr)
                progress.advance(label)
                continue
            metadata = read_metadata(sidecar)
            stats = image_stats(path)
            rating, breakdown = rate_photo(metadata, stats)
            ratings.append(rating)
            report_photos.append({
                'id': photo_id,
                'rating': rating,
                'width': metadata['width'],
                'height': metadata['height'],
                'tags': sorted(metadata.get('visualTags') or []),
                'components': breakdown,
            })
            old_rating = metadata.get('rating')
            if old_rating == rating:
                unchanged += 1
            elif args.check:
                changed += 1
                print(f'{label}: rating {old_rating!r} should be {rating}', file=sys.stderr)
            else:
                changed += 1
                metadata['rating'] = rating
                if not args.dry_run:
                    write_metadata(sidecar, metadata)
            progress.advance(f'{label}: {rating}')
        except Exception as error:  # noqa: BLE001 - report the file and continue
            errors += 1
            print(f'{label}: {error}', file=sys.stderr)
            progress.advance(label)

    progress.finish()
    elapsed = time.monotonic() - started
    mode = 'checked' if args.check else 'dry-run' if args.dry_run else 'updated'
    if ratings:
        average = sum(ratings) / len(ratings)
        buckets = distribution(ratings)
        print(
            f'Photo ratings {mode}: {changed} changed, {unchanged} unchanged, '
            f'{missing} missing sidecar, {errors} errors in {elapsed:.1f}s; '
            f'{len(ratings)} rated, avg {average:.1f}, '
            f'<50 {buckets["under50"]}, 50–69 {buckets["50to69"]}, '
            f'70–84 {buckets["70to84"]}, 85–100 {buckets["85to100"]}, '
            f'perfect {buckets["perfect"]}.'
        )
        if args.report:
            report_path = args.report if args.report.is_absolute() else ROOT / args.report
            report = {
                'city': args.city,
                'total': len(report_photos),
                'average': round(average, 2),
                'min': min(ratings),
                'max': max(ratings),
                'distribution': buckets,
                'photos': report_photos,
            }
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(
                json.dumps(report, ensure_ascii=False, indent=2) + '\n',
                encoding='utf-8',
            )
            print(f'Report: {report_path.relative_to(ROOT)}')
    else:
        print(f'Photo ratings {mode}: no ratings computed in {elapsed:.1f}s.', file=sys.stderr)
    return 1 if errors or missing or (args.check and changed) else 0


if __name__ == '__main__':
    raise SystemExit(main())
