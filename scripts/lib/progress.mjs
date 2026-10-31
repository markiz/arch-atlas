// Shared progress reporting for long-running Node scripts.
//
// Mirrors scripts/progress.py: progress goes to stderr, a known total prints
// done/total, percent, elapsed time, rate and ETA, and the final line is always
// printed. Import it from a script under scripts/:
//
//   import { Progress } from './lib/progress.mjs';
//   const progress = new Progress(items.length, { label: 'hash atlas files' });
//   for (const item of items) {
//     await hash(item);
//     progress.advance(item);
//   }
//   progress.finish();

export function formatDuration(seconds) {
  const value = Math.max(0, Math.round(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export class Progress {
  constructor(total, { label = '', unit = 'items', stream = process.stderr, minInterval = 500, windowMs = 30000 } = {}) {
    this.total = total === null || total === undefined ? null : Math.max(0, Math.trunc(total));
    this.label = String(label).replace(/\s+/g, ' ').trim();
    this.unit = unit;
    this.stream = stream;
    this.minInterval = Math.max(0, Number(minInterval));
    this.windowMs = Math.max(1000, Number(windowMs));
    this.done = 0;
    this.started = null;
    this.lastPrint = 0;
    this.samples = [];
    this.finished = false;
    this.emittedFinal = false;
  }

  start(note = '') {
    if (this.started !== null) return this;
    this.started = Date.now();
    this.samples.push([this.started, 0]);
    this.emit(this.started, note || 'start', true);
    return this;
  }

  update(done = this.done, note = '', force = false) {
    if (this.started === null) {
      this.started = Date.now();
      this.samples.push([this.started, 0]);
    }
    let value = Math.max(0, Math.trunc(Number(done) || 0));
    if (this.total !== null) value = Math.min(value, this.total);
    this.done = value;

    const now = Date.now();
    this.samples.push([now, value]);
    while (this.samples.length > 2 && now - this.samples[0][0] > this.windowMs) this.samples.shift();

    const finished = this.total !== null && value >= this.total;
    const due = force || (finished && !this.emittedFinal) || !this.lastPrint || now - this.lastPrint >= this.minInterval;
    if (due) this.emit(now, note, force);
    return this;
  }

  advance(note = '', count = 1) {
    return this.update(this.done + count, note);
  }

  finish(note = '') {
    if (this.finished) return this;
    if (this.total !== null && this.emittedFinal && this.done >= this.total && !note) {
      this.finished = true;
      return this;
    }
    this.finished = true;
    if (this.started === null) {
      this.started = Date.now();
      this.samples.push([this.started, 0]);
    }
    this.done = this.total === null ? this.done : this.total;
    const now = Date.now();
    this.samples.push([now, this.done]);
    this.emit(now, note || (this.total === null ? 'done' : ''), true);
    return this;
  }

  emit(now, note, force = false) {
    this.lastPrint = now;
    const started = this.started ?? now;
    const elapsed = Math.max(0, (now - started) / 1000);
    const done = this.done;
    const total = this.total;
    this.emittedFinal = total !== null && done >= total;
    const doneText = this.formatValue(done);

    let head;
    if (total === null) {
      head = `[${doneText}]`;
    } else {
      const totalText = this.formatValue(total);
      const width = Math.max(doneText.length, totalText.length);
      const percent = total === 0 ? 100 : (done / total) * 100;
      head = `[${doneText.padStart(width)}/${totalText} ${String(Math.round(percent)).padStart(3)}%]`;
    }

    const rate = this.rate(now);
    const parts = [head, `${formatDuration(elapsed)} elapsed`];
    if (total === null) {
      if (done) parts.push(this.formatRate(rate));
    } else if (done < total) {
      parts.push(rate > 0 ? `~${formatDuration((total - done) / rate)} left` : 'ETA —');
      if (done) parts.push(this.formatRate(rate));
    } else {
      if (done) parts.push(this.formatRate(rate));
      parts.push('done');
    }

    if (this.label) parts.push(this.label);
    const cleanNote = String(note).replace(/\s+/g, ' ').trim();
    if (cleanNote) parts.push(cleanNote.length > 80 ? `${cleanNote.slice(0, 77)}...` : cleanNote);

    try {
      this.stream.write(`${parts.join(' | ')}\n`);
    } catch {
      // Logging must not interrupt data collection.
    }
  }

  rate(now) {
    if (this.samples.length < 2) return 0;
    const [firstTime, firstDone] = this.samples[0];
    const span = (now - firstTime) / 1000;
    if (span <= 0) return 0;
    return Math.max(0, (this.done - firstDone) / span);
  }

  formatValue(value) {
    return String(Math.trunc(value));
  }

  formatRate(rate) {
    if (rate >= 100) return `${rate.toFixed(0)}/s`;
    if (rate >= 10) return `${rate.toFixed(1)}/s`;
    return `${rate.toFixed(2)}/s`;
  }
}
