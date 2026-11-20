import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { CSSProperties, RefObject, TargetedMouseEvent, TargetedPointerEvent } from 'preact';

/** Pixels a finger must travel before the gesture picks an axis. */
const AXIS_LOCK = 7;
/** Horizontal distance that counts as a photo switch. */
const SWIPE_DISTANCE = 44;
/** Tap guard keeps the click synthesized after a drag from opening the lightbox. */
const CLICK_GUARD_MS = 500;
/** Slightly longer than the carousel transition in App.tsx so the commit lands after it. */
const SWIPE_ANIMATION_MS = 220;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

interface Point {
  x: number;
  y: number;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point) {
  return Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * The browser turns a tap into a click after pointerup. A gesture that moved
 * must not trigger that click (it would open the lightbox or close it).
 */
function useClickGuard() {
  const suppressed = useRef(false);
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const suppress = useCallback(() => {
    suppressed.current = true;
    clear();
    timer.current = window.setTimeout(() => {
      suppressed.current = false;
      timer.current = null;
    }, CLICK_GUARD_MS);
  }, []);
  useEffect(() => clear, []);
  const reset = useCallback(() => {
    suppressed.current = false;
    clear();
  }, []);
  const consume = useCallback((event: TargetedMouseEvent<HTMLElement>) => {
    if (!suppressed.current || event.detail === 0) return false;
    suppressed.current = false;
    clear();
    event.preventDefault();
    event.stopPropagation();
    return true;
  }, []);
  return { suppress, consume, reset, suppressed };
}

interface SwipeOptions {
  enabled: boolean;
  onNext: () => void;
  onPrevious: () => void;
  /** Changes when the shown photo is changed by anything other than the gesture. */
  resetKey: string;
  /**
   * A press that never became a swipe. Fired instead of relying on the click
   * synthesized after pointerup: the browser drops that click when the carousel
   * is still sliding, which made a quick tap right after a swipe do nothing.
   */
  onTap?: () => void;
}

interface SwipeSession {
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  axis: 'x' | 'y' | null;
}

interface TapCandidate {
  pointerId: number;
  startX: number;
  startY: number;
}

/**
 * Horizontal drag-to-switch for the inspector preview. `touch-action: pan-y`
 * (set in CSS) leaves vertical scrolling to the browser, so the photo only
 * follows a deliberate sideways drag.
 */
export function usePhotoSwipe({ enabled, onNext, onPrevious, resetKey, onTap }: SwipeOptions) {
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const session = useRef<SwipeSession | null>(null);
  const pendingTap = useRef<TapCandidate | null>(null);
  const timer = useRef<number | null>(null);
  const tapTimer = useRef<number | null>(null);
  const { suppress, consume, reset } = useClickGuard();

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const clearTapTimer = () => {
    if (tapTimer.current !== null) window.clearTimeout(tapTimer.current);
    tapTimer.current = null;
  };
  useEffect(
    () => () => {
      clearTimer();
      clearTapTimer();
    },
    [],
  );
  useEffect(() => {
    clearTimer();
    session.current = null;
    setAnimating(false);
    setOffset(0);
  }, [resetKey]);

  /**
   * The click synthesized after pointerup is dispatched before timers run, so
   * opening the lightbox on the next task lets the click guard swallow it and
   * keeps the tap working even when the browser never synthesizes a click.
   */
  const tap = () => {
    if (!onTap) return;
    suppress();
    clearTapTimer();
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      onTap();
    }, 0);
  };

  const onPointerDown = (event: TargetedPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' || session.current) return;
    // A new press ends the click window of the previous gesture.
    reset();
    if (!enabled) return;
    if (timer.current !== null) {
      // The carousel is still sliding; a second swipe would fight it, but a tap
      // must still open the lightbox, so remember the press and decide on up.
      if (onTap)
        pendingTap.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
        };
      return;
    }
    pendingTap.current = null;
    session.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      axis: null,
    };
  };

  const onPointerMove = (event: TargetedPointerEvent<HTMLElement>) => {
    const candidate = pendingTap.current;
    if (candidate && candidate.pointerId === event.pointerId) {
      const dx = event.clientX - candidate.startX;
      const dy = event.clientY - candidate.startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= AXIS_LOCK) pendingTap.current = null;
      return;
    }
    const current = session.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return;
      current.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      if (current.axis === 'y') return;
    }
    if (current.axis !== 'x') return;
    current.dx = dx;
    setAnimating(false);
    setOffset(dx);
  };

  const finish = (event: TargetedPointerEvent<HTMLElement>, cancelled: boolean) => {
    const candidate = pendingTap.current;
    if (candidate && candidate.pointerId === event.pointerId) {
      pendingTap.current = null;
      if (!cancelled) tap();
      return;
    }
    const current = session.current;
    if (!current || current.pointerId !== event.pointerId) return;
    session.current = null;
    if (current.axis !== 'x') {
      setOffset(0);
      if (current.axis === null && !cancelled) tap();
      return;
    }
    suppress();
    clearTimer();
    const width = event.currentTarget.offsetWidth || 1;
    if (!cancelled && Math.abs(current.dx) >= SWIPE_DISTANCE) {
      const direction = current.dx < 0 ? 1 : -1;
      setAnimating(true);
      setOffset(-direction * width);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setAnimating(false);
        setOffset(0);
        if (direction > 0) onNext();
        else onPrevious();
      }, SWIPE_ANIMATION_MS);
      return;
    }
    setAnimating(true);
    setOffset(0);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setAnimating(false);
    }, SWIPE_ANIMATION_MS);
  };

  return {
    offset,
    animating,
    onPointerDown,
    onPointerMove,
    onPointerUp: (event: TargetedPointerEvent<HTMLElement>) => finish(event, false),
    onPointerCancel: (event: TargetedPointerEvent<HTMLElement>) => finish(event, true),
    consumeClick: consume,
  };
}

interface LightboxOptions {
  enabled: boolean;
  onNext: () => void;
  onPrevious: () => void;
  /** Changes only when a different photo is shown, not when its full file loads. */
  resetKey: string;
  viewRef: RefObject<HTMLDivElement | null>;
  imgRef: RefObject<HTMLImageElement | null>;
}

type GestureMode = 'swipe' | 'pan' | 'pinch';

interface LightboxSession {
  mode: GestureMode;
  pointerId: number | null;
  startX: number;
  startY: number;
  startTransform: Transform;
  pinchDistance: number;
  pinchMidpoint: Point;
  center: Point;
  dx: number;
  axis: 'x' | 'y' | null;
  moved: boolean;
}

function fitTransform(next: Transform, image: HTMLImageElement, view: HTMLElement): Transform {
  const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
  const maxX = Math.max(0, (image.offsetWidth * scale - view.clientWidth) / 2);
  const maxY = Math.max(0, (image.offsetHeight * scale - view.clientHeight) / 2);
  return {
    scale,
    x: clamp(next.x, -maxX, maxX),
    y: clamp(next.y, -maxY, maxY),
  };
}

/**
 * Pinch zoom plus one-finger pan and swipe for the lightbox. At scale 1 a
 * horizontal drag switches photos; once zoomed the same drag moves the photo
 * and a pinch controls the scale around its midpoint.
 */
export function usePhotoLightboxGestures({
  enabled,
  onNext,
  onPrevious,
  resetKey,
  viewRef,
  imgRef,
}: LightboxOptions) {
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [sliding, setSliding] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const transformRef = useRef<Transform>(IDENTITY);
  const pointers = useRef(new Map<number, Point>());
  const session = useRef<LightboxSession | null>(null);
  const carouselTimer = useRef<number | null>(null);
  const { suppress, consume, reset, suppressed } = useClickGuard();
  const guard = () => {
    if (!suppressed.current) suppress();
  };

  const clearCarouselTimer = () => {
    if (carouselTimer.current !== null) window.clearTimeout(carouselTimer.current);
    carouselTimer.current = null;
  };
  useEffect(() => clearCarouselTimer, []);

  const apply = (next: Transform, animate = false) => {
    transformRef.current = next;
    setTransform(next);
    setZoomed(next.scale > 1.001);
    setAnimating(animate);
  };

  const settle = () => {
    const view = viewRef.current;
    const image = imgRef.current;
    if (!view || !image) return;
    const next = fitTransform(transformRef.current, image, view);
    apply(next.scale < 1.002 ? { ...IDENTITY } : next, true);
  };

  useLayoutEffect(() => {
    clearCarouselTimer();
    pointers.current.clear();
    session.current = null;
    transformRef.current = IDENTITY;
    setTransform(IDENTITY);
    setOffset(0);
    setSliding(false);
    setZoomed(false);
    setAnimating(false);
  }, [resetKey]);

  const onPointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    if (event.button !== 0) return;
    // A new press ends the click window of the previous gesture, even while the
    // carousel is still sliding; otherwise the tap that follows a swipe is lost.
    reset();
    if ((event.target as Element).closest('a, button')) return;
    if (carouselTimer.current !== null) return;
    const view = viewRef.current;
    const image = imgRef.current;
    if (!view || !image) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setAnimating(false);
    const rect = view.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const current = transformRef.current;
    if (pointers.current.size === 1) {
      session.current = {
        mode: current.scale > 1.001 ? 'pan' : 'swipe',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTransform: current,
        pinchDistance: 0,
        pinchMidpoint: center,
        center,
        dx: 0,
        axis: null,
        moved: false,
      };
    } else if (pointers.current.size === 2) {
      clearCarouselTimer();
      setOffset(0);
      setSliding(false);
      setAnimating(false);
      const [a, b] = [...pointers.current.values()];
      session.current = {
        mode: 'pinch',
        pointerId: null,
        startX: 0,
        startY: 0,
        startTransform: current,
        pinchDistance: distance(a, b),
        pinchMidpoint: midpoint(a, b),
        center,
        dx: 0,
        axis: null,
        moved: true,
      };
    }
  };

  const onPointerMove = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = session.current;
    const view = viewRef.current;
    const image = imgRef.current;
    if (!current || !view || !image) return;
    if (current.mode === 'pinch') {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const ratio = distance(a, b) / current.pinchDistance;
      const scale = clamp(current.startTransform.scale * ratio, MIN_SCALE, MAX_SCALE);
      const factor = scale / current.startTransform.scale;
      const mid = midpoint(a, b);
      apply(
        fitTransform(
          {
            scale,
            x:
              mid.x -
              current.center.x -
              factor * (current.pinchMidpoint.x - current.center.x - current.startTransform.x),
            y:
              mid.y -
              current.center.y -
              factor * (current.pinchMidpoint.y - current.center.y - current.startTransform.y),
          },
          image,
          view,
        ),
      );
      guard();
      return;
    }
    const point = pointers.current.get(event.pointerId);
    if (!point || current.pointerId !== event.pointerId) return;
    const dx = point.x - current.startX;
    const dy = point.y - current.startY;
    if (current.mode === 'swipe') {
      if (!enabled) return;
      if (!current.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return;
        current.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      }
      if (current.axis !== 'x') return;
      current.dx = dx;
      current.moved = true;
      setAnimating(false);
      setSliding(true);
      setOffset(dx);
      guard();
      return;
    }
    apply(
      fitTransform(
        {
          scale: current.startTransform.scale,
          x: current.startTransform.x + dx,
          y: current.startTransform.y + dy,
        },
        image,
        view,
      ),
    );
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      current.moved = true;
      guard();
    }
  };

  const finishPointer = (pointerId: number, cancelled: boolean) => {
    const current = session.current;
    const view = viewRef.current;
    const image = imgRef.current;
    pointers.current.delete(pointerId);
    if (!current || !view || !image) {
      if (!pointers.current.size) session.current = null;
      return;
    }
    if (current.mode === 'pinch') {
      if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        session.current = {
          mode: 'pinch',
          pointerId: null,
          startX: 0,
          startY: 0,
          startTransform: transformRef.current,
          pinchDistance: distance(a, b),
          pinchMidpoint: midpoint(a, b),
          center: current.center,
          dx: 0,
          axis: null,
          moved: true,
        };
      } else if (pointers.current.size === 1) {
        const [pointer, point] = [...pointers.current.entries()][0];
        const next = transformRef.current;
        suppress();
        session.current = {
          mode: next.scale > 1.001 ? 'pan' : 'swipe',
          pointerId: pointer,
          startX: point.x,
          startY: point.y,
          startTransform: next,
          pinchDistance: 0,
          pinchMidpoint: point,
          center: current.center,
          dx: 0,
          axis: null,
          moved: true,
        };
      } else {
        session.current = null;
        suppress();
        settle();
      }
      return;
    }
    if (current.pointerId !== pointerId) return;
    session.current = null;
    if (current.mode === 'swipe') {
      if (current.axis === 'x' && current.moved) {
        suppress();
        clearCarouselTimer();
        const width = view.clientWidth || 1;
        if (!cancelled && enabled && Math.abs(current.dx) >= SWIPE_DISTANCE) {
          const direction = current.dx < 0 ? 1 : -1;
          setAnimating(true);
          setOffset(-direction * width);
          carouselTimer.current = window.setTimeout(() => {
            carouselTimer.current = null;
            setAnimating(false);
            setSliding(false);
            setOffset(0);
            if (direction > 0) onNext();
            else onPrevious();
          }, SWIPE_ANIMATION_MS);
        } else {
          setAnimating(true);
          setOffset(0);
          carouselTimer.current = window.setTimeout(() => {
            carouselTimer.current = null;
            setAnimating(false);
            setSliding(false);
          }, SWIPE_ANIMATION_MS);
        }
      }
      return;
    }
    if (current.moved) suppress();
    settle();
  };

  const trackStyle: CSSProperties = {
    transform: `translateX(${offset}px)`,
    transition: animating ? 'transform 200ms cubic-bezier(0.2, 0.7, 0.3, 1)' : 'none',
  };
  const imageStyle: CSSProperties = {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
    transition: animating ? 'transform 200ms cubic-bezier(0.2, 0.7, 0.3, 1)' : 'none',
    transformOrigin: '50% 50%',
  };

  return {
    trackStyle,
    imageStyle,
    zoomed,
    sliding,
    onPointerDown,
    onPointerMove,
    onPointerUp: (event: TargetedPointerEvent<HTMLDivElement>) =>
      finishPointer(event.pointerId, false),
    onPointerCancel: (event: TargetedPointerEvent<HTMLDivElement>) =>
      finishPointer(event.pointerId, true),
    consumeClick: consume,
  };
}
