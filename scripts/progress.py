#!/usr/bin/env python3
"""Shared progress reporting for long-running data scripts.

The contract for every script that fetches data, parses large dumps or loops
over many objects:

* progress goes to stderr, while final/machine-readable results stay on stdout;
* a known total prints done/total, percent, elapsed time, rate and an ETA;
* an unknown total prints completed work, elapsed time and rate, without
  inventing an ETA;
* the last line is always printed, even for tiny or empty jobs.

Import it directly from a script under ``scripts/``:

    from progress import Progress

    progress = Progress(len(items), 'fetch records')
    for item in items:
        fetch(item)
        progress.advance(item['id'])
    progress.finish()
"""
from __future__ import annotations

import sys
import threading
import time
from collections import deque
from typing import TextIO


def format_duration(seconds: float) -> str:
    """Format seconds as M:SS or H:MM:SS for logs."""
    seconds = max(0, int(round(seconds)))
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f'{hours}:{minutes:02d}:{secs:02d}'
    return f'{minutes:02d}:{secs:02d}'


def format_bytes(value: float) -> str:
    """Format a byte count with binary units; used for hashing/download phases."""
    value = float(value)
    for unit in ('B', 'KiB', 'MiB', 'GiB', 'TiB'):
        if abs(value) < 1024 or unit == 'TiB':
            if unit == 'B':
                return f'{int(value)} B'
            return f'{value:.1f} {unit}'
        value /= 1024
    return f'{value:.1f} TiB'


class Progress:
    """Thread-safe, log-friendly progress line writer.

    ``total`` may be ``None`` when the number of items cannot be known in
    advance (for example a streaming PBF scan). In that case no ETA is shown.
    Updates are throttled by ``min_interval`` seconds, but the final line and
    explicit ``force=True`` updates are always printed.
    """

    def __init__(
        self,
        total: int | None = None,
        label: str = '',
        unit: str = 'items',
        stream: TextIO | None = None,
        min_interval: float = 0.5,
        window: float = 30.0,
    ) -> None:
        self.total = max(0, int(total)) if total is not None else None
        self.label = ' '.join(str(label).split())
        self.unit = unit
        self.stream = stream if stream is not None else sys.stderr
        self.min_interval = max(0.0, float(min_interval))
        self.window = max(1.0, float(window))
        self._lock = threading.RLock()
        self._done = 0
        self._started: float | None = None
        self._last_print = 0.0
        self._samples: deque[tuple[float, int]] = deque(maxlen=128)
        self._finished = False
        self._emitted_final = False

    def start(self, note: str = '') -> 'Progress':
        """Print the first line and start the timer (idempotent)."""
        with self._lock:
            if self._started is not None:
                return self
            now = time.monotonic()
            self._started = now
            self._samples.append((now, 0))
            self._emit(now, note or 'start', force=True)
        return self

    def update(self, done: int | None = None, note: str = '', force: bool = False) -> 'Progress':
        """Set the completed count (or keep it) and print when due."""
        with self._lock:
            if self._started is None:
                now = time.monotonic()
                self._started = now
                self._samples.append((now, 0))
            if done is None:
                done = self._done
            done = max(0, int(done))
            if self.total is not None:
                done = min(done, self.total)
            self._done = done

            now = time.monotonic()
            self._samples.append((now, done))
            while len(self._samples) > 2 and now - self._samples[0][0] > self.window:
                self._samples.popleft()

            finished = self.total is not None and done >= self.total
            due = force or (finished and not self._emitted_final) or not self._last_print
            due = due or (now - self._last_print) >= self.min_interval
            if due:
                self._emit(now, note, force=force)
        return self

    def advance(self, note: str = '', count: int = 1) -> 'Progress':
        """Add ``count`` to the completed counter and print when due."""
        with self._lock:
            return self.update(self._done + count, note)

    def finish(self, note: str = '') -> 'Progress':
        """Print the final 100% line exactly once."""
        with self._lock:
            if self._finished:
                return self
            if self.total is not None and self._emitted_final and self._done >= self.total and not note:
                self._finished = True
                return self
            self._finished = True
            if self._started is None:
                now = time.monotonic()
                self._started = now
                self._samples.append((now, 0))
            done = self.total if self.total is not None else self._done
            self._done = done
            now = time.monotonic()
            self._samples.append((now, done))
            self._emit(now, note if note or self.total is not None else 'done', force=True)
        return self

    def _emit(self, now: float, note: str, force: bool = False) -> None:
        # Called with self._lock held.
        self._last_print = now
        started = self._started if self._started is not None else now
        elapsed = max(0.0, now - started)
        done = self._done
        total = self.total
        self._emitted_final = total is not None and done >= total

        if total is None:
            done_text = self._format_value(done)
            head = f'[{done_text}]'
            percent = None
        else:
            done_text = self._format_value(done)
            total_text = self._format_value(total)
            width = max(len(done_text), len(total_text))
            percent = 100.0 if total == 0 else (done / total) * 100.0
            head = f'[{done_text.rjust(width)}/{total_text} {percent:3.0f}%]'

        rate = self._rate(now)
        parts = [head, f'{format_duration(elapsed)} elapsed']
        if total is None:
            if done:
                parts.append(self._format_rate(rate))
        elif done < total:
            if rate > 0:
                parts.append(f'~{format_duration((total - done) / rate)} left')
            else:
                parts.append('ETA —')
            if done:
                parts.append(self._format_rate(rate))
        else:
            if done:
                parts.append(self._format_rate(rate))
            parts.append('done')

        if self.label:
            parts.append(self.label)
        clean_note = ' '.join(str(note).split())
        if clean_note:
            if len(clean_note) > 80:
                clean_note = clean_note[:77] + '...'
            parts.append(clean_note)

        try:
            print(' | '.join(parts), file=self.stream, flush=True)
        except (OSError, ValueError):
            pass

    def _rate(self, now: float) -> float:
        if len(self._samples) < 2:
            return 0.0
        first_time, first_done = self._samples[0]
        span = now - first_time
        if span <= 0:
            return 0.0
        return max(0.0, (self._done - first_done) / span)

    def _format_value(self, value: int) -> str:
        if self.unit == 'bytes':
            return format_bytes(value)
        return str(int(value))

    def _format_rate(self, rate: float) -> str:
        if self.unit == 'bytes':
            return f'{format_bytes(rate)}/s'
        if rate >= 100:
            return f'{rate:.0f}/s'
        if rate >= 10:
            return f'{rate:.1f}/s'
        return f'{rate:.2f}/s'
