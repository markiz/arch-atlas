#!/usr/bin/env python3
"""Assign standardized visual tags to atlas photos with a local CLIP model.

The taxonomy lives in ``data/photo-visual-tags.json`` (38 tags, under the
50-tag budget). The model is the quantized ONNX export of
``Xenova/clip-vit-base-patch32``; it is not committed, only cached under
``.cache/clip``. A few cheap optical measurements supplement CLIP:
brightness/dark-pixel share for ``nighttime``/``dark`` and Laplacian variance
for ``blurry``.

Tags are written to the photo sidecar as ``visualTags`` in taxonomy order.
Existing visual tags are reused unless ``--force`` is given, so the command is
safe to rerun after every photo batch. The optional ``--download-model`` flag
fetches the ~150 MB ONNX model and tokenizer.

Usage:
  npm run photos:visual-tags -- --download-model
  python3 scripts/classify-photo-visuals.py --only b86c5529
  python3 scripts/classify-photo-visuals.py --dry-run
  python3 scripts/classify-photo-visuals.py --force
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

from atlas_source import CITY, ROOT, read_cards, read_photo_metadata, write_photo_metadata
from progress import Progress

try:
    import numpy as np
    import onnxruntime as ort
    from PIL import Image, ImageOps
    from tokenizers import Tokenizer
except ImportError as error:  # pragma: no cover - environment guard
    print(
        f'Missing visual-classification dependency: {error}\n'
        'Install them in a local venv, for example:\n'
        '  python3 -m venv work/photo-classify-venv\n'
        '  work/photo-classify-venv/bin/pip install onnxruntime tokenizers pillow numpy\n'
        '  work/photo-classify-venv/bin/python scripts/classify-photo-visuals.py --download-model',
        file=sys.stderr,
    )
    raise SystemExit(2)

TAXONOMY = ROOT / 'data' / 'photo-visual-tags.json'
REPORT = ROOT / 'work' / 'photo-research' / 'visual-tags.json'
MODEL_DIR = ROOT / '.cache' / 'clip'
MODEL_FILES = {
    'model_quantized.onnx': 'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/model_quantized.onnx',
    'tokenizer.json': 'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/tokenizer.json',
    'preprocessor_config.json': 'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/preprocessor_config.json',
    'config.json': 'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/config.json',
}
USER_AGENT = 'TbilisiArchitectureAtlasPhotos/1.2 (educational atlas research)'
KIND_ORDER = {'scene': 0, 'object': 1, 'condition': 2}
SCENE_MAX = 3
OBJECT_MAX = 2
OBJECT_FIRST = 0.30
OBJECT_SECOND = 0.25
TEMPERATURE = 100.0


def download_model(model_dir: Path) -> None:
    model_dir.mkdir(parents=True, exist_ok=True)
    for name, url in MODEL_FILES.items():
        target = model_dir / name
        if target.exists() and target.stat().st_size > 0:
            continue
        request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
        with urllib.request.urlopen(request, timeout=120) as response:
            total = int(response.headers.get('Content-Length') or 0)
            progress = Progress(total or None, f'download {name}', unit='bytes')
            progress.start(f'{total / 1024 / 1024:.1f} MiB' if total else 'unknown size')
            temporary = target.with_suffix(target.suffix + '.part')
            done = 0
            try:
                with temporary.open('wb') as handle:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        handle.write(chunk)
                        done += len(chunk)
                        progress.update(done, f'{done / 1024 / 1024:.1f} MiB')
                temporary.replace(target)
            finally:
                temporary.unlink(missing_ok=True)
            progress.finish()


def load_taxonomy(path: Path) -> tuple[dict, list[dict]]:
    payload = json.loads(path.read_text(encoding='utf-8'))
    tags = payload.get('tags')
    if not isinstance(tags, list) or not tags:
        raise SystemExit(f'{path}: tags must be a non-empty array')
    if len(tags) >= 50:
        raise SystemExit(f'{path}: taxonomy must stay below 50 tags, found {len(tags)}')
    seen: set[str] = set()
    for tag in tags:
        tag_id = tag.get('id')
        if not isinstance(tag_id, str) or not tag_id or tag_id in seen:
            raise SystemExit(f'{path}: duplicate or empty tag id {tag_id!r}')
        seen.add(tag_id)
        if tag.get('kind') not in KIND_ORDER:
            raise SystemExit(f'{path}: {tag_id} has unknown kind {tag.get("kind")!r}')
        prompts = tag.get('prompts')
        if not isinstance(prompts, list) or not prompts or not all(isinstance(item, str) and item.strip() for item in prompts):
            raise SystemExit(f'{path}: {tag_id} needs non-empty prompts')
    return payload, tags


def build_prompt_index(tags: list[dict]) -> tuple[list[str], list[tuple[dict, list[int]]]]:
    prompts: list[str] = []
    index: list[tuple[dict, list[int]]] = []
    for tag in tags:
        positions = list(range(len(prompts), len(prompts) + len(tag['prompts'])))
        prompts.extend(tag['prompts'])
        index.append((tag, positions))
    return prompts, index


def softmax(values: np.ndarray) -> np.ndarray:
    scaled = (values - values.max()) * TEMPERATURE
    exponent = np.exp(scaled)
    return exponent / exponent.sum()


def load_image(path: Path, size: int = 224, mean=(0.48145466, 0.4578275, 0.40821073), std=(0.26862954, 0.26130258, 0.27577711)) -> np.ndarray:
    with Image.open(path) as opened:
        image = ImageOps.exif_transpose(opened).convert('RGB')
    width, height = image.size
    scale = size / min(width, height)
    if scale != 1:
        image = image.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.BICUBIC)
    left = (image.width - size) // 2
    top = (image.height - size) // 2
    image = image.crop((left, top, left + size, top + size))
    array = np.asarray(image, dtype=np.float32) / 255.0
    array = (array - np.asarray(mean, dtype=np.float32)) / np.asarray(std, dtype=np.float32)
    return array.transpose(2, 0, 1)


def optical_stats(path: Path) -> tuple[float, float, float]:
    with Image.open(path) as opened:
        gray = ImageOps.exif_transpose(opened).convert('L').resize((128, 128))
    small = np.asarray(gray, dtype=np.float32)
    brightness = float(small.mean())
    dark_share = float((small < 30).mean())
    with Image.open(path) as opened:
        gray = ImageOps.exif_transpose(opened).convert('L').resize((256, 256))
    values = np.asarray(gray, dtype=np.float32)
    padded = np.pad(values, 1, mode='edge')
    laplacian = padded[:-2, 1:-1] + padded[2:, 1:-1] + padded[1:-1, :-2] + padded[1:-1, 2:] - 4 * values
    return brightness, dark_share, float(laplacian.var())


def classify_one(sims: np.ndarray, index: list[tuple[dict, list[int]]], stats: tuple[float, float, float]) -> tuple[list[str], dict]:
    brightness, dark_share, blur_variance = stats
    by_kind: dict[str, list[tuple[dict, float]]] = {'scene': [], 'object': [], 'condition': []}
    for tag, positions in index:
        by_kind[tag['kind']].append((tag, float(sims[positions].mean())))

    probabilities: dict[str, list[tuple[dict, float]]] = {}
    for kind, entries in by_kind.items():
        probs = softmax(np.asarray([entry[1] for entry in entries], dtype=np.float32))
        probabilities[kind] = [(entry[0], float(prob)) for entry, prob in zip(entries, probs)]

    assigned: dict[str, str] = {}

    # Scene: keep all above their threshold, but an interior never keeps an
    # exterior scene tag as well.
    scene = [(tag, prob) for tag, prob in probabilities['scene'] if prob >= float(tag['threshold'])]
    scene.sort(key=lambda item: item[1], reverse=True)
    if any(tag['id'] == 'interior' for tag, _ in scene):
        scene = [(tag, prob) for tag, prob in scene if tag['id'] == 'interior']
    for tag, prob in scene[:SCENE_MAX]:
        assigned[tag['id']] = f'scene:{prob:.2f}'

    # Objects: only the strongest one or two labels; CLIP is noisy on facades
    # with many small architectural elements.
    objects = sorted(probabilities['object'], key=lambda item: item[1], reverse=True)
    chosen = 0
    for tag, prob in objects:
        if chosen >= OBJECT_MAX:
            break
        floor = OBJECT_FIRST if chosen == 0 else OBJECT_SECOND
        if prob >= max(floor, float(tag['threshold'])):
            assigned[tag['id']] = f'object:{prob:.2f}'
            chosen += 1

    # Conditions: CLIP plus cheap optical checks for the common cases.
    condition_probs = {tag['id']: prob for tag, prob in probabilities['condition']}
    if condition_probs.get('nighttime', 0) >= 0.55 or (brightness < 55 and dark_share > 0.35):
        assigned['nighttime'] = f'condition:{condition_probs.get("nighttime", 0):.2f}'
    if condition_probs.get('dark', 0) >= 0.6 or (brightness < 35 and 'nighttime' not in assigned):
        assigned['dark'] = f'condition:{condition_probs.get("dark", 0):.2f}'
    if condition_probs.get('blurry', 0) >= 0.6 or blur_variance < 120:
        assigned['blurry'] = f'condition:{condition_probs.get("blurry", 0):.2f}'
    for tag_id in ('tilted', 'snow', 'rain'):
        if condition_probs.get(tag_id, 0) >= 0.65:
            assigned[tag_id] = f'condition:{condition_probs[tag_id]:.2f}'

    tags = [tag['id'] for tag, _positions in index if tag['id'] in assigned]
    details = {
        'reasons': dict(assigned),
        'brightness': round(brightness, 1),
        'darkShare': round(dark_share, 3),
        'blurVariance': round(blur_variance, 1),
    }
    return tags, details


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--taxonomy', default=str(TAXONOMY))
    parser.add_argument('--model-dir', default=str(MODEL_DIR))
    parser.add_argument('--download-model', action='store_true')
    parser.add_argument('--only', help='comma-separated photo ids or id prefixes')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--batch-size', type=int, default=1)
    parser.add_argument('--force', action='store_true', help='reclassify photos that already have visualTags')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    taxonomy_path = Path(args.taxonomy)
    payload, tags = load_taxonomy(taxonomy_path)
    prompts, index = build_prompt_index(tags)
    model_dir = Path(args.model_dir)
    if args.download_model:
        download_model(model_dir)
    missing = [name for name in MODEL_FILES if not (model_dir / name).exists()]
    if missing:
        raise SystemExit(
            f'Missing CLIP model files in {model_dir}: {", ".join(missing)}\n'
            'Run with --download-model or place the files there manually.'
        )

    tokenizer = Tokenizer.from_file(str(model_dir / 'tokenizer.json'))
    tokenizer.enable_truncation(max_length=77)
    tokenizer.enable_padding(length=77, pad_id=1, pad_token='<|endoftext|>')
    encoded = tokenizer.encode_batch(prompts)
    input_ids = np.asarray([item.ids for item in encoded], dtype=np.int64)
    attention_mask = np.asarray([item.attention_mask for item in encoded], dtype=np.int64)
    session = ort.InferenceSession(str(model_dir / 'model_quantized.onnx'), providers=['CPUExecutionProvider'])

    cards = read_cards()
    referenced = sorted({photo_id for card in cards.values() for photo_id in card.get('photos', [])})
    selected = [value.strip() for value in args.only.split(',')] if args.only else None
    photos: list[str] = []
    for photo_id in referenced:
        if selected is not None and not any(photo_id.startswith(prefix) for prefix in selected):
            continue
        photos.append(photo_id)
    if args.limit is not None:
        photos = photos[:args.limit]

    progress = Progress(len(photos), 'classify photo visuals')
    progress.start(f'{len(photos)} photos, {len(tags)} tags, model {payload.get("model", "")}')
    updated = cached = errors = 0
    report: dict[str, dict] = {}
    started = time.monotonic()
    pending: list[str] = []
    for photo_id in photos:
        metadata = read_photo_metadata(photo_id)
        if not metadata:
            errors += 1
            print(f'{photo_id[:12]}: metadata sidecar is missing', file=sys.stderr)
            progress.advance(photo_id[:12] + ': error')
            continue
        if metadata.get('visualTags') and not args.force:
            cached += 1
            progress.advance(photo_id[:12] + ': cached')
            continue
        pending.append(photo_id)

    for start in range(0, len(pending), max(1, args.batch_size)):
        batch = pending[start:start + max(1, args.batch_size)]
        pixel_values = np.stack([load_image(ROOT / 'data' / 'photos' / CITY / f'{photo_id}.webp') for photo_id in batch])
        outputs = session.run(
            ['text_embeds', 'image_embeds'],
            {'input_ids': input_ids, 'attention_mask': attention_mask, 'pixel_values': pixel_values},
        )
        text = outputs[0] / np.linalg.norm(outputs[0], axis=1, keepdims=True)
        images = outputs[1] / np.linalg.norm(outputs[1], axis=1, keepdims=True)
        similarities = images @ text.T
        for offset, photo_id in enumerate(batch):
            stats = optical_stats(ROOT / 'data' / 'photos' / CITY / f'{photo_id}.webp')
            assigned, details = classify_one(similarities[offset], index, stats)
            report[photo_id] = {'tags': assigned, **details}
            if assigned:
                metadata = read_photo_metadata(photo_id) or {}
                metadata['visualTags'] = assigned
            else:
                metadata = read_photo_metadata(photo_id) or {}
                metadata.pop('visualTags', None)
            if not args.dry_run:
                write_photo_metadata(photo_id, metadata, CITY, replace_tags=('visualTags',))
            updated += 1
            progress.advance(photo_id[:12] + f': {",".join(assigned) if assigned else "no tags"}')

    progress.finish()
    elapsed = time.monotonic() - started
    report_payload = {
        'date': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'model': payload.get('model'),
        'taxonomyVersion': payload.get('version'),
        'taxonomyTags': [tag['id'] for tag in tags],
        'processed': updated,
        'cached': cached,
        'errors': errors,
        'items': report,
        'dry_run': args.dry_run,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report_payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(
        f'Visual tags: {updated} processed, {cached} cached, {errors} errors, '
        f'{len(tags)} tags in taxonomy in {elapsed:.1f}s.'
    )
    print(f'Report: {REPORT.relative_to(ROOT)}')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
