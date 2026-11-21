import { useEffect, useState } from 'preact/hooks';

/** Hosts where the development overlay is useful: the local dev server only. */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return (
    host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost')
  );
}

/**
 * Frame-rate readout for local development. Frames are counted over a fixed
 * window instead of averaged, so a long repaint drops the number at once.
 */
export function FpsMeter() {
  const [readout, setReadout] = useState('— fps');
  useEffect(() => {
    let frames = 0;
    let windowStart = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames++;
      const elapsed = now - windowStart;
      if (elapsed >= 500) {
        const fps = (frames * 1000) / elapsed;
        setReadout(`${fps.toFixed(0)} fps · ${(1000 / fps).toFixed(1)} ms`);
        frames = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="fps-meter" aria-hidden="true">
      {readout}
    </div>
  );
}
