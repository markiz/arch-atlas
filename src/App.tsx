import { Fragment, type ComponentChild } from 'preact';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { FeatureCollection } from 'geojson';
import type { Building, CitiesCatalog, CityPublic, Data, Filters, Photo } from './types';
import { filterBuildings, normalize, period, periodsFor, styleEntries } from './domain';
import {
  buildingAddress,
  buildingArchitects,
  buildingDistrict,
  buildingName,
  buildingStyle,
  buildingText,
  buildingYearLabel,
} from './building-text';
import MapView from './MapView';
import type { MapViewProps } from './map/types';
import { isMobileMapLayout } from './map/start-view';
import { I18nContext, cityTitle, translate, type Language, useI18n } from './i18n';
import { buildHash, isLanguage, parseHash, type View } from './routing';
import { LANGUAGE_NAMES, type Language as CityLanguage } from './languages.ts';
import {
  rankPhotos,
  useBuildingPhotos,
  useFullPhoto,
  useLazyPhoto,
  useVisibility,
  type BuildingPhotos,
} from './photos';
import { usePhotoLightboxGestures, usePhotoSwipe } from './photo-gestures';
import { readResponseBytes } from './fetch-progress';

const initialFilters: Filters = {
  query: '',
  from: '',
  to: '',
  architect: [],
  style: [],
  interestingOnly: true,
};
const base = import.meta.env.BASE_URL + 'atlas/';
/** Cards per catalog page. Bounds how many photo bitmaps the grid loads. */
const CATALOG_PAGE_SIZE = 60;
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  const paths: Record<string, ComponentChild> = {
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    map: (
      <>
        <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
        <path d="M9 4v14M15 6v14" />
      </>
    ),
    list: (
      <>
        <path d="M9 6h12M9 12h12M9 18h12" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    close: (
      <>
        <path d="M5 5l14 14M19 5 5 19" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    pin: (
      <>
        <path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 0 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" fill="currentColor" />
        <circle cx="16" cy="17" r="2" fill="currentColor" />
      </>
    ),
    external: (
      <>
        <path d="M13 5h6v6M19 5 10 14" />
        <path d="M19 14v5H5V5h5" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}
function InfoTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false),
    ref = useRef<HTMLSpanElement>(null),
    buttonRef = useRef<HTMLButtonElement>(null),
    bubbleRef = useRef<HTMLSpanElement>(null),
    hideTimer = useRef<number | null>(null),
    id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current,
      bubble = bubbleRef.current;
    if (!button || !bubble) return;
    const margin = 12,
      gap = 9,
      rect = button.getBoundingClientRect(),
      width = bubble.offsetWidth,
      height = bubble.offsetHeight;
    const left = Math.max(
      margin,
      Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - margin),
    );
    let above = rect.top - height - gap,
      placement: 'top' | 'bottom' = 'top';
    if (above < margin) {
      above = rect.bottom + gap;
      placement = 'bottom';
    }
    const top = Math.max(margin, Math.min(above, window.innerHeight - height - margin));
    const arrow = Math.max(12, Math.min(rect.left + rect.width / 2 - left, width - 12));
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.style.setProperty('--tip-arrow-left', `${arrow}px`);
    bubble.dataset.placement = placement;
    bubble.style.visibility = 'visible';
  }, [open, text]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  useEffect(
    () => () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    },
    [],
  );
  const show = () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      setOpen(true);
    },
    hide = () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setOpen(false), 180);
    };
  return (
    <span
      ref={ref}
      className="info-tip"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') show();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') hide();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="info-tip-button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {open &&
        createPortal(
          <span
            ref={bubbleRef}
            className="info-tip-bubble"
            role="tooltip"
            id={id}
            style={{ visibility: 'hidden' }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
function photoTechnicalNote(modifications: string, t: (value: string) => string) {
  const clauses = modifications
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !/полное качество|оригинал.*не (?:использ|сохран)/i.test(value));
  const clean = clauses.join('; ').replace(/\.$/, '');
  const width = clean.match(/уменьшен размер до\s+(\d+)\s*px/i);
  const kept = clean.match(/ширина сохранена\s*\((\d+)\s*px\)/i);
  const resized = /уменьшен размер/i.test(clean);
  const parts: string[] = [];
  if (width) parts.push(t('Ширина уменьшена до ') + width[1] + ' px');
  else if (kept) parts.push(t('Ширина сохранена: ') + kept[1] + ' px');
  else if (resized) parts.push(t('Размер уменьшен'));
  if (/webp/i.test(clean)) parts.push(t('Фото преобразовано в WebP'));
  const other = clauses
    .filter(
      (value) =>
        !/уменьшен размер/i.test(value) && !/webp/i.test(value) && !/ширина сохранена/i.test(value),
    )
    .join('; ');
  if (other) parts.push(other);
  return parts.length ? parts.join(' · ') : clean;
}
function photoCreditText(photo: Photo, t: (value: string) => string) {
  const author = (photo.author || '').trim(),
    license = (photo.license || '').trim();
  if (author && license) return `${t('Фото: ')}${author} · ${license}`;
  if (author) return `${t('Фото: ')}${author}`;
  return license;
}
function PeriodChoices({
  periods,
  selected,
  onToggle,
  onHover,
  className,
}: {
  periods: { id: string; label: string; color: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onHover: (id: string | null) => void;
  className: string;
}) {
  const { t } = useI18n();
  return (
    <div className={className}>
      {periods.map((p) => (
        <button
          type="button"
          key={p.id}
          className={selected.includes(p.id) ? 'active' : ''}
          aria-pressed={selected.includes(p.id)}
          onMouseEnter={() => onHover(p.id)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(p.id)}
          onBlur={() => onHover(null)}
          onClick={() => onToggle(p.id)}
        >
          <i style={{ background: p.color }} />
          {t(p.label)}
        </button>
      ))}
    </div>
  );
}
function PeriodPicker({
  periods,
  selected,
  onToggle,
  onHover,
}: {
  periods: { id: string; label: string; color: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const { t } = useI18n();
  const selectedLabel = periods.find((p) => p.id === selected[0])?.label;
  const summary =
    selected.length === 0
      ? t('Все периоды')
      : selected.length === 1
        ? t(selectedLabel ?? 'Неизвестно')
        : `${t('Выбрано: ')}${selected.length}`;
  return (
    <details className="period-picker">
      <summary>
        <span>{summary}</span>
        <i aria-hidden="true" />
      </summary>
      <div className="period-picker-menu">
        {periods.map((p) => (
          <label key={p.id} onMouseEnter={() => onHover(p.id)} onMouseLeave={() => onHover(null)}>
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => onToggle(p.id)}
            />
            <i style={{ background: p.color }} />
            {t(p.label)}
          </label>
        ))}
      </div>
    </details>
  );
}
function MultiSelect({
  id,
  label,
  allLabel,
  options,
  selected,
  onToggle,
}: {
  id: string;
  label: string;
  allLabel: string;
  options: { value: string; label: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const { t, language } = useI18n();
  const [query, setQuery] = useState('');
  const visible = options.filter((option) => normalize(option.label).includes(normalize(query)));
  const selectedLabels = selected.map(
    (value) => options.find((option) => option.value === value)?.label || value,
  );
  const more =
    selected.length > 3
      ? language === 'ru'
        ? `, ещё ${selected.length - 3}`
        : language === 'ka'
          ? `, კიდევ ${selected.length - 3}`
          : language === 'uk'
            ? `, ще ${selected.length - 3}`
            : `, +${selected.length - 3} more`
      : '';
  const summary =
    selected.length === 0 ? t(allLabel) : selectedLabels.slice(0, 3).join(', ') + more;
  return (
    <div className="multi-filter">
      <label id={`${id}-label`}>{t(label)}</label>
      <details className="multi-picker">
        <summary aria-labelledby={`${id}-label`}>
          <span>{summary}</span>
          <i aria-hidden="true" />
        </summary>
        <div className="multi-picker-menu">
          <label className="multi-search">
            <Icon name="search" size={14} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={t('Найти…')}
              aria-label={t('Поиск: ') + t(label)}
            />
          </label>
          {selected.length > 0 && (
            <button
              type="button"
              className="multi-clear"
              onClick={() => selected.forEach(onToggle)}
            >
              {t('Снять выбор')}
            </button>
          )}
          <div className="multi-options">
            {visible.length ? (
              visible.map((option) => (
                <label key={option.value} className="multi-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => onToggle(option.value)}
                  />
                  <span>{option.label}</span>
                  <small>{option.count}</small>
                </label>
              ))
            ) : (
              <p className="multi-empty">{t('Совпадений нет')}</p>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
function photoSourceHost(source: string) {
  try {
    return new URL(source).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
function PhotoLightbox({
  building,
  src,
  previousSrc,
  nextSrc,
  index,
  total,
  description,
  credit,
  onClose,
  onNext,
  onPrevious,
  opener,
}: {
  building: Building;
  src: string;
  previousSrc?: string;
  nextSrc?: string;
  index: number;
  total: number;
  description?: string;
  credit?: Photo;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  opener: { current: HTMLButtonElement | null };
}) {
  const { t, language } = useI18n();
  const name = buildingName(building, language);
  const sourceHost = credit ? photoSourceHost(credit.source) : '';
  const creditText = credit ? photoCreditText(credit, t) : '';
  const viewRef = useRef<HTMLDivElement>(null),
    imgRef = useRef<HTMLImageElement>(null),
    badgeRef = useRef<HTMLAnchorElement>(null);
  const gestures = usePhotoLightboxGestures({
    enabled: total > 1,
    onNext,
    onPrevious,
    resetKey: `${building.id}:${credit?.file ?? index}`,
    viewRef,
    imgRef,
  });
  const placeBadge = () => {
    const view = viewRef.current,
      img = imgRef.current,
      badge = badgeRef.current;
    if (!view || !img || !badge || !img.complete || (src && !img.currentSrc.endsWith(src))) return;
    const width = img.offsetWidth,
      height = img.offsetHeight;
    if (!width || !height) return;
    const inset = window.matchMedia('(max-width: 650px)').matches ? 6 : 10;
    badge.style.left = `${Math.round((view.clientWidth - width) / 2 + width - inset)}px`;
    badge.style.top = `${Math.round((view.clientHeight - height) / 2 + height - inset)}px`;
    badge.style.visibility = 'visible';
  };
  useLayoutEffect(() => {
    if (badgeRef.current) badgeRef.current.style.visibility = 'hidden';
    if (gestures.zoomed) return;
    placeBadge();
    const resize = () => placeBadge();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [src, gestures.zoomed]);
  const closeButton = useRef<HTMLButtonElement>(null);
  // Layout effect: the dialog takes over the keyboard immediately after the
  // portal commits, so Escape cannot slip through before the listener exists.
  useLayoutEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') onNext();
      else if (event.key === 'ArrowLeft') onPrevious();
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = previousOverflow;
      opener.current?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t('Фотографии: ') + name}
      onClick={(event) => {
        if (gestures.consumeClick(event)) return;
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="lightbox"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="lightbox-top">
          <span>
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          <button
            ref={closeButton}
            className="lightbox-close"
            onClick={onClose}
            aria-label={t('Закрыть фотографию')}
          >
            <Icon name="close" size={22} />
          </button>
        </div>
        <div
          className={`lightbox-view${gestures.zoomed ? ' zoomed' : ''}${gestures.sliding ? ' sliding' : ''}`}
          ref={viewRef}
          onPointerDown={gestures.onPointerDown}
          onPointerMove={gestures.onPointerMove}
          onPointerUp={gestures.onPointerUp}
          onPointerCancel={gestures.onPointerCancel}
          onClick={(event) => {
            if (gestures.consumeClick(event)) return;
            if (event.target === event.currentTarget) onClose();
          }}
        >
          {total > 1 && (
            <button
              className="lightbox-nav previous"
              onClick={onPrevious}
              aria-label={t('Предыдущая фотография')}
            >
              ‹
            </button>
          )}
          <div className="lightbox-track" style={gestures.trackStyle}>
            <div className="lightbox-slide previous" aria-hidden="true">
              {previousSrc && <img src={previousSrc} alt="" draggable={false} />}
            </div>
            <div className="lightbox-slide current">
              <img
                ref={imgRef}
                src={src}
                alt={`${name}, ${t('фотография ')}${index + 1}`}
                style={gestures.imageStyle}
                draggable={false}
                onLoad={placeBadge}
              />
            </div>
            <div className="lightbox-slide next" aria-hidden="true">
              {nextSrc && <img src={nextSrc} alt="" draggable={false} />}
            </div>
          </div>
          {credit && sourceHost && (
            <a
              ref={badgeRef}
              className="lightbox-source"
              href={credit.source}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              aria-label={`${t('Источник фото')}: ${sourceHost}`}
            >
              {sourceHost}
            </a>
          )}
          {total > 1 && (
            <button
              className="lightbox-nav next"
              onClick={onNext}
              aria-label={t('Следующая фотография')}
            >
              ›
            </button>
          )}
        </div>
        <div className="lightbox-caption">
          <strong>{name}</strong>
          {description && <p>{description}</p>}
          {credit && (
            <p className="photo-credit">
              {creditText && (
                <>
                  <a href={credit.source} target="_blank" rel="noreferrer">
                    {creditText}
                  </a>
                  <span> · </span>
                </>
              )}
              <a href={credit.licenseUrl} target="_blank" rel="noreferrer">
                {t(credit.license ? 'Условия лицензии' : 'Источник фото')}
              </a>
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
function LoaderLine({ value }: { value?: number }) {
  const { t } = useI18n();
  const determinate = value !== undefined;
  const percent = determinate ? Math.round(Math.max(0, Math.min(1, value)) * 100) : null;
  return (
    <div
      className={`loader-line${determinate ? '' : ' indeterminate'}`}
      role={determinate ? 'progressbar' : undefined}
      aria-label={determinate ? t('Загрузка данных') : undefined}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={percent ?? undefined}
    >
      <span style={percent === null ? undefined : { width: `${percent}%` }} />
    </div>
  );
}
function CatalogLoader({ error, onRetry }: { error: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="loading">
      <div className="loading-mark">
        ა<span>•</span>
      </div>
      <p className="eyebrow">{t('АРХИТЕКТУРНЫЙ АТЛАС')}</p>
      <h1>{t('АРХИТЕКТУРНЫЙ АТЛАС')}</h1>
      <LoaderLine />
      <p>{error || t('Загружаем карту и данные…')}</p>
      {error && (
        <button className="primary-button" onClick={onRetry}>
          {t('Попробовать снова')}
        </button>
      )}
    </div>
  );
}

function CityLoader({ city, onReady }: { city: CityPublic; onReady: (data: Data) => void }) {
  const { t, language } = useI18n();
  const [status, setStatus] = useState('Загружаем карту и данные…'),
    [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function run() {
      try {
        setError('');
        setStatus('Загружаем карту и данные…');
        setProgress(null);
        const revision = import.meta.env.DEV
          ? String(Date.now())
          : (city.manifestRevision ?? __ATLAS_REVISION__);
        const get = async (path: string, version = revision) => {
          const r = await fetch(`${base}${path}?v=${encodeURIComponent(version)}`, {
            signal: controller.signal,
          });
          if (!r.ok) throw new Error(`Не удалось загрузить ${path}`);
          return r;
        };
        const manifest = (await (await get(`cities/${city.id}/manifest.json`)).json()) as {
          version: number;
          city: string;
          revision: string;
          entry: { buildings: string; basemap: string; outlines: string };
          files: { path: string; size: number; sha256: string }[];
        };
        if (
          manifest.version !== 2 ||
          manifest.city !== city.id ||
          !manifest.entry ||
          !Array.isArray(manifest.files)
        )
          throw new Error('Неизвестная версия пакета');
        if (!crypto.subtle)
          throw new Error('Для проверки пакета откройте атлас через HTTPS или localhost');
        const byPath = new Map(manifest.files.map((file) => [file.path, file]));
        const outlines = byPath.get(manifest.entry.outlines);
        if (!outlines) throw new Error('В пакете нет контуров зданий');
        const corePaths = new Set([manifest.entry.buildings, manifest.entry.basemap]);
        const initialFiles = manifest.files.filter((file) => corePaths.has(file.path));
        if (initialFiles.length !== corePaths.size) throw new Error('В пакете нет данных города');
        const photoFiles = new Map(manifest.files.map((file) => [file.path, file]));
        const files = new Map<string, ArrayBuffer>();
        let done = 0;
        const total = initialFiles.reduce((n, file) => n + file.size, 0);
        let loaded = 0;
        let nextFile = 0;
        let lastReport = -Infinity;
        const report = (force = false) => {
          if (cancelled) return;
          const now = performance.now();
          if (!force && now - lastReport < 100) return;
          lastReport = now;
          setProgress(total > 0 ? loaded / total : 0);
          setStatus(
            `Загружено ${(loaded / 1048576).toFixed(1)} из ${(total / 1048576).toFixed(1)} МБ · ${done}/${initialFiles.length}`,
          );
        };
        report(true);
        const loadNext = async () => {
          while (nextFile < initialFiles.length) {
            const file = initialFiles[nextFile++];
            if (file.path.includes('..') || file.path.startsWith('/'))
              throw new Error('Некорректный путь в пакете');
            let fileLoaded = 0;
            const response = await get(file.path, file.sha256);
            const bytes = await readResponseBytes(response, file.size, (value) => {
              loaded += value - fileLoaded;
              fileLoaded = value;
              report();
            });
            const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
              .map((x) => x.toString(16).padStart(2, '0'))
              .join('');
            if (hash !== file.sha256) throw new Error(`Поврежден файл ${file.path}`);
            files.set(file.path, bytes);
            done++;
            report(true);
          }
        };
        await Promise.all(Array.from({ length: Math.min(6, initialFiles.length) }, loadNext));
        if (cancelled) return;
        setProgress(1);
        setStatus('Подготавливаем карту и фотографии');
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (cancelled) return;
        const decode = (path: string) => {
          const bytes = files.get(path);
          if (!bytes) throw new Error(`В пакете нет ${path}`);
          return JSON.parse(new TextDecoder().decode(bytes));
        };
        const buildings: Building[] = decode(manifest.entry.buildings),
          basemap: FeatureCollection = decode(manifest.entry.basemap);
        for (const item of buildings)
          for (const photo of item.photos ?? (item.photo ? [item.photo] : []))
            if (
              !photoFiles.has(photo.file) ||
              !photoFiles.has(photo.thumb) ||
              (photo.card && !photoFiles.has(photo.card))
            )
              throw new Error(`В пакете нет фото ${item.names?.ru || item.id}`);
        if (!cancelled) {
          onReady({
            city,
            buildings,
            basemap,
            buildingOutlines: outlines,
            photoFiles,
            detailsFiles: {},
          });
        }
      } catch (e) {
        controller.abort();
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      }
    }
    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attempt, city, onReady]);
  return (
    <div className="loading">
      <div className="loading-mark">
        ა<span>•</span>
      </div>
      <p className="eyebrow">{t('АРХИТЕКТУРНЫЙ АТЛАС')}</p>
      <h1>{cityTitle(city.labels[language] ?? city.labels.ru ?? city.id, language)}</h1>
      <LoaderLine value={error ? undefined : (progress ?? undefined)} />
      <p>
        {error || (progress !== null ? `${Math.round(progress * 100)}% · ${t(status)}` : t(status))}
      </p>
      {error && (
        <button className="primary-button" onClick={() => setAttempt((x) => x + 1)}>
          {t('Попробовать снова')}
        </button>
      )}
    </div>
  );
}
function LanguageOptions({ city }: { city: CityPublic }) {
  return (
    <>
      {city.languages.map((code) => (
        <option key={code} value={code}>
          {LANGUAGE_NAMES[code]}
        </option>
      ))}
    </>
  );
}

function CardPhoto({
  building,
  photoFiles,
}: {
  building: Building;
  photoFiles: Data['photoFiles'];
}) {
  const { t } = useI18n();
  const photo = rankPhotos(building.photos ?? (building.photo ? [building.photo] : []))[0];
  const { ref, visible } = useVisibility<HTMLSpanElement>();
  const { url, error } = useLazyPhoto(
    photo?.card ?? photo?.thumb ?? photo?.file,
    photoFiles,
    visible,
  );
  if (!photo) return <div className="no-photo">{t('Фотографии пока нет')}</div>;
  return (
    <span ref={ref} className="card-photo">
      {url ? (
        <img src={url} alt="" />
      ) : error ? (
        <div className="no-photo">{t('Фото недоступно')}</div>
      ) : (
        <span className="photo-skeleton" aria-hidden="true" />
      )}
    </span>
  );
}
type InspectorPhotos = BuildingPhotos & { retry: () => void };
function Inspector({
  building,
  city,
  photos,
  photoFiles,
  onClose,
  onMap,
  onFilter,
}: {
  building: Building;
  city: CityPublic;
  photos: InspectorPhotos;
  photoFiles: Data['photoFiles'];
  onClose: () => void;
  onMap: () => void;
  onFilter: (key: 'architect' | 'style', value: string) => void;
}) {
  const { t, language } = useI18n();
  const name = buildingName(building, language);
  const text = buildingText(building, undefined, language);
  const description = text.description.trim();
  const history = text.history;
  const individualStyles = styleEntries(building, language) as { id: string; label: string }[];
  const constructionLabel = buildingYearLabel(building, language);
  const district = buildingDistrict(building, language);
  const address = buildingAddress(building, language);
  const geometryQuality = text.geometryQuality;
  const architects = buildingArchitects(building, language);
  const [photoIndex, setPhotoIndex] = useState(0),
    [lightboxOpen, setLightboxOpen] = useState(false);
  // The window keydown listener is subscribed once per building, so it reads
  // the current lightbox state from a ref: an effect closure lags behind on
  // runtimes that flush passive effects after paint, and Escape pressed right
  // after opening a photo would close the card too.
  const lightboxOpenRef = useRef(lightboxOpen);
  lightboxOpenRef.current = lightboxOpen;
  const images = photos.assets;
  const current = images[photoIndex] ?? images[0];
  const previousAsset =
    images.length > 1 ? images[(photoIndex - 1 + images.length) % images.length] : undefined;
  const nextAsset = images.length > 1 ? images[(photoIndex + 1) % images.length] : undefined;
  const previousPreview = previousAsset?.thumb;
  const nextPreview = nextAsset?.thumb;
  const credits = current?.photo;
  const photoNote = credits ? photoTechnicalNote(credits.modifications, t) : '';
  const creditText = credits ? photoCreditText(credits, t) : '';
  const { url: fullUrl } = useFullPhoto(current?.photo, photoFiles);
  const preview = current?.thumb ?? fullUrl;
  const gallery = fullUrl ?? current?.thumb;
  const swipe = usePhotoSwipe({
    enabled: images.length > 1,
    onNext: nextPhoto,
    onPrevious: previousPhoto,
    resetKey: current?.photo.file ?? '',
    onTap: () => setLightboxOpen(true),
  });
  const close = useRef<HTMLButtonElement>(null),
    photoOpener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
  }, [building.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lightboxOpenRef.current) onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [building.id]);
  const googleMapsQuery = encodeURIComponent(
    `${building.names.en || building.names.ru || building.id}, ${building.addresses?.en || ''}, ${city.labels.en}, ${city.country.en}`,
  );
  const googleMapsUrl = building.googlePlaceId
    ? `https://www.google.com/maps/search/?api=1&query=${googleMapsQuery}&query_place_id=${encodeURIComponent(building.googlePlaceId)}`
    : `https://www.google.com/maps/search/?api=1&query=${building.addresses?.en ? googleMapsQuery : encodeURIComponent(`${building.coordinates[1]},${building.coordinates[0]}`)}`;
  function nextPhoto() {
    setPhotoIndex((i) => (images.length ? (i + 1) % images.length : 0));
  }
  function previousPhoto() {
    setPhotoIndex((i) => (images.length ? (i + images.length - 1) % images.length : 0));
  }
  const p = period(building.minYear, building.maxYear, city.periods)!;
  return (
    <>
      <aside className="inspector" aria-label={t('Информация: ') + name}>
        <div className="inspect-top">
          <span>
            {t('ОБЪЕКТ АТЛАСА')} <span className="index-no">/ {building.id.toUpperCase()}</span>
          </span>
          <button
            ref={close}
            className="icon-btn"
            onClick={onClose}
            aria-label={t('Закрыть карточку')}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="inspect-scroll">
          <div className="photo-wrap">
            {images.length ? (
              preview ? (
                <>
                  <button
                    ref={photoOpener}
                    className="photo-open"
                    onPointerDown={swipe.onPointerDown}
                    onPointerMove={swipe.onPointerMove}
                    onPointerUp={swipe.onPointerUp}
                    onPointerCancel={swipe.onPointerCancel}
                    onClick={(event) => {
                      if (swipe.consumeClick(event)) return;
                      setLightboxOpen(true);
                    }}
                    aria-label={
                      t('Открыть фотографию ') + `${photoIndex + 1}` + t(' на весь экран')
                    }
                  >
                    <div
                      className={`photo-carousel${swipe.offset || swipe.animating ? ' sliding' : ''}`}
                      style={{
                        transform: `translateX(${swipe.offset}px)`,
                        transition: swipe.animating ? 'transform 200ms ease-out' : 'none',
                      }}
                    >
                      <div className="photo-slide previous" aria-hidden="true">
                        {previousPreview && <img src={previousPreview} alt="" draggable={false} />}
                      </div>
                      <div className="photo-slide current">
                        <img
                          src={preview}
                          alt={`${name}, ${t('фотография ')}${photoIndex + 1}`}
                          className={credits?.tags?.includes('stamp') ? 'stamp-photo' : undefined}
                          draggable={false}
                        />
                      </div>
                      <div className="photo-slide next" aria-hidden="true">
                        {nextPreview && <img src={nextPreview} alt="" draggable={false} />}
                      </div>
                    </div>
                  </button>
                  {images.length > 1 && (
                    <>
                      <button
                        className="photo-prev"
                        aria-label={t('Предыдущая фотография')}
                        onClick={previousPhoto}
                      >
                        ‹
                      </button>
                      <button
                        className="photo-next"
                        aria-label={t('Следующая фотография')}
                        onClick={nextPhoto}
                      >
                        ›
                      </button>
                    </>
                  )}
                  <span className="photo-number">
                    {String(photoIndex + 1).padStart(2, '0')} /{' '}
                    {String(images.length).padStart(2, '0')}
                  </span>
                  {credits?.tags?.includes('stamp') && (
                    <span className="photo-stamp-badge">{t('МАРКА')}</span>
                  )}
                  {photos.phase === 'preview' && (
                    <span className="photo-loading-note">{t('Галерея загружается…')}</span>
                  )}
                </>
              ) : photos.status === 'error' ? (
                <div className="photo-error">
                  <p>{photos.error || t('Не удалось загрузить фотографии')}</p>
                  <button onClick={photos.retry}>{t('Попробовать снова')}</button>
                </div>
              ) : photos.phase === 'preview' ? (
                <div className="photo-loading">
                  <span className="photo-spinner" aria-hidden="true" />
                  <span>{t('Загружаем фотографии…')}</span>
                </div>
              ) : (
                <div className="photo-unavailable">
                  <span>{t('Фото недоступно')}</span>
                  {images.length > 1 && (
                    <>
                      <button
                        className="photo-prev"
                        aria-label={t('Предыдущая фотография')}
                        onClick={previousPhoto}
                      >
                        ‹
                      </button>
                      <button
                        className="photo-next"
                        aria-label={t('Следующая фотография')}
                        onClick={nextPhoto}
                      >
                        ›
                      </button>
                    </>
                  )}
                  <span className="photo-number">
                    {String(photoIndex + 1).padStart(2, '0')} /{' '}
                    {String(images.length).padStart(2, '0')}
                  </span>
                </div>
              )
            ) : photos.status === 'loading' ? (
              <div className="photo-loading">
                <span className="photo-spinner" aria-hidden="true" />
                <span>{t('Загружаем фотографии…')}</span>
              </div>
            ) : (
              <div className="no-photo">{t('Фотографии пока нет')}</div>
            )}
          </div>
          <div className="inspect-body">
            <div className="inspect-meta">
              <span>
                <span className="period-dot" style={{ background: p.color }} />
                {t(p.label)}
              </span>
              <span>{district}</span>
            </div>
            <h2>{name}</h2>
            <p className="georgian">{building.names.ka}</p>
            <a
              className="address address-link"
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={
                t('Открыть адрес «') +
                (address || t('Адрес не установлен')) +
                t('» в Google Картах')
              }
            >
              <Icon name="pin" size={15} />
              {address || t('Адрес не установлен')}
              <Icon name="external" size={12} />
            </a>
            {description && <p className="description">{description}</p>}
            {building.geometryRole === 'heritage_boundary' && (
              <p className="geometry-note">
                {t('Показана охраняемая граница памятника, а не надземный контур здания.')}
              </p>
            )}
            <div className="details">
              <div>
                <span>{t('ПОСТРОЕНО')}</span>
                <strong>{constructionLabel}</strong>
              </div>
              <div>
                <span>{t('СТИЛЬ')}</span>
                <strong>
                  {individualStyles.map((item, index) => (
                    <Fragment key={item.id}>
                      {index > 0 ? ', ' : ''}
                      {item.id !== 'undetermined' ? (
                        <button
                          className="detail-filter"
                          onClick={() => onFilter('style', item.id)}
                          aria-label={t('Фильтр по стилю: ') + item.label}
                        >
                          <span className="detail-filter-text">{item.label}</span>
                        </button>
                      ) : (
                        item.label
                      )}
                    </Fragment>
                  ))}
                </strong>
              </div>
              <div className="full">
                <span>{t('АРХИТЕКТОР')}</span>
                <strong>
                  {architects.length
                    ? architects.map((architect, index) => (
                        <Fragment key={building.architectIds[index] || architect}>
                          {index > 0 ? ', ' : ''}
                          <button
                            className="detail-filter"
                            onClick={() =>
                              onFilter('architect', building.architectIds[index] || architect)
                            }
                            aria-label={t('Фильтр по архитектору: ') + architect}
                          >
                            <span className="detail-filter-text">{architect}</span>
                          </button>
                        </Fragment>
                      ))
                    : t('Не установлен')}
                </strong>
              </div>
            </div>
            {history.trim() && (
              <>
                <div className="section-rule" />
                <p className="eyebrow">{t('ИСТОРИЯ ЗДАНИЯ')}</p>
                <p className="history">{history}</p>
              </>
            )}
            <button className="text-link map-link" onClick={onMap}>
              <Icon name="pin" size={15} /> {t('Показать на карте')} <Icon name="arrow" size={16} />
            </button>
            <div className="credits">
              <p>{t('ДАННЫЕ И ФОТОГРАФИЯ')}</p>
              <a href={building.source} target="_blank" rel="noreferrer">
                {t('Источник сведений')} <Icon name="external" size={12} />
              </a>
              {building.otherSource && (
                <a href={building.otherSource} target="_blank" rel="noreferrer">
                  {t('Дополнительный источник')} <Icon name="external" size={12} />
                </a>
              )}
              {credits && (
                <>
                  {creditText && (
                    <a href={credits.source} target="_blank" rel="noreferrer">
                      {creditText} <Icon name="external" size={12} />
                    </a>
                  )}
                  <span className="credit-line">
                    <a href={credits.licenseUrl} target="_blank" rel="noreferrer">
                      {t(credits.license ? 'Условия лицензии' : 'Источник фото')}
                    </a>
                    {photoNote && (
                      <InfoTip text={photoNote} label={t('Технические сведения о фотографии')} />
                    )}
                  </span>
                </>
              )}
              {building.geometryQuality && (
                <span className="credit-line credit-contour">
                  <span>{t('Контур')}</span>
                  <InfoTip text={geometryQuality} label={t('Технические сведения о контуре')} />
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>
      {lightboxOpen && credits && gallery && (
        <PhotoLightbox
          building={building}
          src={gallery}
          previousSrc={previousPreview}
          nextSrc={nextPreview}
          index={photoIndex}
          total={images.length}
          description={credits.descriptions?.[language]}
          credit={credits}
          onClose={() => setLightboxOpen(false)}
          onNext={nextPhoto}
          onPrevious={previousPhoto}
          opener={photoOpener}
        />
      )}
    </>
  );
}
function AppContent({
  data,
  city,
  cities,
  onCityChange,
}: {
  data: Data;
  city: CityPublic;
  cities: CityPublic[];
  onCityChange: (id: string) => void;
}) {
  const { language, t, setLanguage } = useI18n();
  const periods = city.periods;
  const init = useMemo(parseHash, []),
    [view, setView] = useState<View>(init.view),
    [selected, setSelected] = useState<string | null>(init.building),
    [filters, setFilters] = useState<Filters>(initialFilters),
    [showFilters, setShowFilters] = useState(false),
    [showLegend, setShowLegend] = useState(
      () => typeof window === 'undefined' || !window.matchMedia('(max-width: 650px)').matches,
    ),
    [menuOpen, setMenuOpen] = useState(false),
    [hoveredPeriod, setHoveredPeriod] = useState<string | null>(null),
    [selectedPeriods, setSelectedPeriods] = useState<string[]>([]),
    [focus, setFocus] = useState<{ id: string; serial: number } | null>(null),
    /**
     * On phones the inspector covers the map completely, so both "Show on map"
     * and the close button only hide the card. The selection itself stays in
     * `selected`, which keeps the outline on the map for the last tapped
     * building. The wide layout closes the card for real instead.
     */
    [inspectorHidden, setInspectorHidden] = useState(false),
    [reset, setReset] = useState(0),
    [fit, setFit] = useState(0),
    [sort, setSort] = useState('name'),
    [visibleCount, setVisibleCount] = useState(CATALOG_PAGE_SIZE);
  const opener = useRef<HTMLElement | null>(null),
    firstHash = useRef(true),
    mobileMenu = useRef<HTMLElement | null>(null);
  const filtered = useMemo(() => {
    const results = filterBuildings(data.buildings, filters) as Building[];
    return selectedPeriods.length
      ? results.filter((b) =>
          periodsFor(b.minYear, b.maxYear, periods).some((p) => selectedPeriods.includes(p.id)),
        )
      : results;
  }, [data.buildings, filters, selectedPeriods, periods]);
  const architects = useMemo(() => {
    const byId = new Map<string, { value: string; label: string; count: number }>();
    for (const building of data.buildings)
      building.architectIds.forEach((id, index) => {
        const existing = byId.get(id);
        if (existing) existing.count++;
        else
          byId.set(id, {
            value: id,
            label:
              building.architectsByLanguage?.[language]?.[index] ||
              building.architectIds[index] ||
              id,
            count: 1,
          });
      });
    const options = [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, language));
    const unknownCount = data.buildings.filter(
      (building) => building.architectIds.length === 0,
    ).length;
    if (unknownCount)
      options.push({ value: 'unknown', label: t('Не установлен'), count: unknownCount });
    return options;
  }, [data.buildings, language, t]);
  const styleOptions = useMemo(() => {
    const byId = new Map<string, { value: string; label: string; count: number }>();
    for (const building of data.buildings)
      for (const style of styleEntries(building, language)) {
        const existing = byId.get(style.id);
        if (existing) existing.count++;
        else byId.set(style.id, { value: style.id, label: style.label, count: 1 });
      }
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, language));
  }, [data.buildings, language]);
  const selectedBuilding = data.buildings.find((x) => x.id === selected) || null;
  const selectedPhotos = useBuildingPhotos(selectedBuilding, data.photoFiles);
  const sortName = (building: Building) => buildingName(building, language);
  const sorted = [...filtered].sort((a, b) =>
    sort === 'name'
      ? sortName(a).localeCompare(sortName(b), language)
      : sort === 'old'
        ? (a.minYear ?? Infinity) - (b.minYear ?? Infinity) ||
          sortName(a).localeCompare(sortName(b), language)
        : (b.minYear ?? -Infinity) - (a.minYear ?? -Infinity) ||
          sortName(a).localeCompare(sortName(b), language),
  );
  useEffect(() => {
    setVisibleCount(CATALOG_PAGE_SIZE);
  }, [filters, selectedPeriods, sort, view]);
  useEffect(() => {
    // A hidden card is closed for the reader, so its id leaves the address bar
    // too; on phones the selection stays to keep the outline on the map.
    const hash = buildHash({
      city: city.id,
      view,
      building: selected && !inspectorHidden ? selected : null,
      language,
    });
    if (firstHash.current) {
      firstHash.current = false;
      if (location.hash !== hash) history.replaceState(null, '', hash);
    } else if (location.hash !== hash) history.pushState(null, '', hash);
  }, [city.id, view, selected, language, inspectorHidden]);
  useEffect(() => {
    const pop = () => {
      const h = parseHash();
      setView(h.view);
      setSelected(h.building);
      // A history entry with a building means an open card, even on phones.
      setInspectorHidden(false);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const root = mobileMenu.current;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      root
        ? [...root.querySelectorAll<HTMLElement>('button, select, a[href], input')].filter(
            (element) => !element.hasAttribute('disabled') && element.offsetParent !== null,
          )
        : [];
    const timer = window.setTimeout(() => focusable()[0]?.focus(), 30);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [menuOpen]);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 651px)');
    const onChange = () => {
      if (query.matches) {
        setMenuOpen(false);
        // The wide layout shows the inspector beside the map, so bring it back.
        setInspectorHidden(false);
      }
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    if (selected && !filtered.some((x) => x.id === selected)) setSelected(null);
  }, [filtered, selected]);
  function select(id: string) {
    opener.current = document.activeElement as HTMLElement;
    setSelected(id);
    setInspectorHidden(false);
  }
  function close() {
    if (isMobileMapLayout()) {
      // Keep the last tapped building outlined on the phone map; only the
      // sheet goes away.
      setInspectorHidden(true);
    } else {
      setSelected(null);
    }
    setTimeout(() => opener.current?.focus(), 0);
  }
  function goMap(id: string) {
    setView('map');
    setSelected(id);
    setFocus({ id, serial: Date.now() });
    if (isMobileMapLayout()) setInspectorHidden(true);
  }
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((x) => ({ ...x, [key]: value }));
  }
  function filterBy(key: 'architect' | 'style', value: string) {
    setFilters((x) => ({ ...x, [key]: x[key].includes(value) ? x[key] : [...x[key], value] }));
    setShowFilters(true);
  }
  function toggleMultiFilter(key: 'architect' | 'style', value: string) {
    setFilters((x) => ({
      ...x,
      [key]: x[key].includes(value) ? x[key].filter((item) => item !== value) : [...x[key], value],
    }));
  }
  function resetFilters() {
    setFilters(initialFilters);
    setSelectedPeriods([]);
    setHoveredPeriod(null);
  }
  function togglePeriod(id: string) {
    setHoveredPeriod(null);
    setSelectedPeriods((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }
  const activeCount =
    Number(!!filters.from || !!filters.to) +
    Number(filters.architect.length > 0) +
    Number(filters.style.length > 0) +
    Number(selectedPeriods.length > 0);
  const hasActiveFilters = !!filters.query.trim() || activeCount > 0;
  const mapProps: MapViewProps = {
    city,
    buildings: filtered,
    allBuildings: data.buildings,
    basemap: data.basemap as FeatureCollection,
    buildingOutlines: data.buildingOutlines,
    selected,
    onSelect: select,
    focus,
    reset,
    fit,
    showFit: hasActiveFilters,
    onFit: () => setFit((value) => value + 1),
    selectedPeriods,
    hoveredPeriod,
    onFocusHandled: () => setFocus(null),
  };
  return (
    <div className="app-shell">
      <header className="header">
        <a
          className="brand"
          href={buildHash({ city: city.id, view: 'map', building: null, language })}
          onClick={(event) => {
            event.preventDefault();
            setView('map');
            setSelected(null);
          }}
          aria-label={t('АРХИТЕКТУРНЫЙ АТЛАС')}
        >
          <span className="brand-symbol">ა</span>
          <span className="brand-name">{t('АРХИТЕКТУРНЫЙ АТЛАС')}</span>
        </a>
        <div className="header-city">
          <select
            id="city"
            className="city-select"
            aria-label={t('ГОРОД')}
            value={city.id}
            onChange={(e) => onCityChange(e.currentTarget.value)}
          >
            {cities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.labels[language] ?? item.labels.ru ?? item.id}
              </option>
            ))}
          </select>
        </div>
        <div className="header-right">
          <label className="city-label language-label" htmlFor="language">
            {t('ЯЗЫК')}
          </label>
          <select
            id="language"
            className="city-select language-select"
            aria-label={t('ЯЗЫК')}
            value={language}
            onChange={(e) => setLanguage(e.currentTarget.value as CityLanguage)}
          >
            <LanguageOptions city={city} />
          </select>
        </div>
      </header>
      <main className="workspace">
        <>
          <div className="toolbar">
            <label className="search">
              <Icon name="search" size={18} />
              <input
                aria-label={t('Поиск по атласу')}
                value={filters.query}
                onChange={(e) => update('query', e.currentTarget.value)}
                placeholder={t('Название, архитектор, адрес…')}
              />
              {filters.query && (
                <button onClick={() => update('query', '')} aria-label={t('Очистить поиск')}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </label>
            <button
              type="button"
              className="mobile-menu-button"
              aria-label={t('Открыть меню')}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls="atlas-mobile-menu"
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" size={20} />
            </button>
            <button
              className={'filter-button ' + (showFilters ? 'active' : '')}
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
            >
              <Icon name="sliders" size={17} /> {t('Фильтры')}{' '}
              {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
            </button>
            <div className="view-toggle" role="group" aria-label={t('Вид атласа')}>
              <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>
                <Icon name="map" size={16} /> {t('Карта')}
              </button>
              <button
                className={view === 'catalog' ? 'active' : ''}
                onClick={() => setView('catalog')}
              >
                <Icon name="list" size={16} /> {t('Каталог')}
              </button>
            </div>
          </div>
          {showFilters && (
            <div className="filter-panel">
              <div className="period-filter">
                <span className="period-filter-label">{t('Период постройки')}</span>
                <PeriodPicker
                  periods={periods}
                  selected={selectedPeriods}
                  onToggle={togglePeriod}
                  onHover={setHoveredPeriod}
                />
              </div>
              <div>
                <label htmlFor="from">{t('Год от')}</label>
                <input
                  id="from"
                  type="number"
                  placeholder={t('Например, 1800')}
                  value={filters.from}
                  onChange={(e) => update('from', e.currentTarget.value)}
                />
              </div>
              <div>
                <label htmlFor="to">{t('Год до')}</label>
                <input
                  id="to"
                  type="number"
                  placeholder={t('Например, 1920')}
                  value={filters.to}
                  onChange={(e) => update('to', e.currentTarget.value)}
                />
              </div>
              <MultiSelect
                id="architect"
                label="Архитектор"
                allLabel="Все архитекторы"
                options={architects}
                selected={filters.architect}
                onToggle={(value) => toggleMultiFilter('architect', value)}
              />
              <MultiSelect
                id="style"
                label="Стиль"
                allLabel="Все стили"
                options={styleOptions}
                selected={filters.style}
                onToggle={(value) => toggleMultiFilter('style', value)}
              />
              <div className="interesting-filter">
                <label title={t('Прячет жилые дома без описания и истории')}>
                  <input
                    type="checkbox"
                    checked={filters.interestingOnly}
                    onChange={(e) => update('interestingOnly', e.currentTarget.checked)}
                  />
                  <span>{t('Только интересные')}</span>
                </label>
              </div>
              <button className="reset-filter" onClick={resetFilters}>
                {t('Сбросить')}
              </button>
            </div>
          )}
          <div className={'content ' + (selectedBuilding ? 'has-selection' : '')}>
            <div className="view-main">
              {view === 'map' ? (
                <>
                  <MapView {...mapProps} />
                  <div className="map-caption">
                    <span className="caption-dot" /> {city.labels[language]},{' '}
                    {city.country[language]} <span className="caption-line" />{' '}
                    {filtered.length !== data.buildings.length
                      ? `${filtered.length}/${data.buildings.length}`
                      : data.buildings.length}{' '}
                    {t('ОБЪЕКТОВ')}
                  </div>
                  <button
                    className="overview"
                    onClick={() => setReset((x) => x + 1)}
                    title={t('Вернуться к центру')}
                  >
                    ⌖
                  </button>
                  <div className={'legend ' + (!showLegend ? 'compact' : '')}>
                    <button
                      type="button"
                      className="legend-head"
                      onClick={() => setShowLegend(!showLegend)}
                      aria-expanded={showLegend}
                      aria-controls="legend-details"
                    >
                      <span>{t('Период постройки')}</span>
                      <span className="legend-toggle" aria-hidden="true">
                        {showLegend ? '−' : '+'}
                      </span>
                    </button>
                    {showLegend && (
                      <div id="legend-details">
                        <div className="legend-colors">
                          {periods
                            .filter((p) => p.min !== null)
                            .map((p) => (
                              <span key={p.label} style={{ background: p.color }} />
                            ))}
                        </div>
                        <div className="legend-range">
                          <span>{t(periods[0].label)}</span>
                          <span>{t(periods[periods.length - 2].label)}</span>
                        </div>
                        <PeriodChoices
                          periods={periods}
                          className="legend-list legend-period-options"
                          selected={selectedPeriods}
                          onToggle={togglePeriod}
                          onHover={setHoveredPeriod}
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="catalog">
                  <div className="catalog-head">
                    <div>
                      <h2>{t('Каталог')}</h2>
                    </div>
                    <label>
                      {t('Сортировка')}{' '}
                      <select value={sort} onChange={(e) => setSort(e.currentTarget.value)}>
                        <option value="name">{t('По названию')}</option>
                        <option value="old">{t('Сначала старые')}</option>
                        <option value="new">{t('Сначала новые')}</option>
                      </select>
                    </label>
                  </div>
                  {!sorted.length ? (
                    <div className="empty">
                      {data.buildings.length === 0 ? (
                        <>
                          <h3>{t('В этом городе пока нет объектов.')}</h3>
                          <p>{t('Данные об архитектуре этого города пока не добавлены.')}</p>
                        </>
                      ) : (
                        <>
                          <h3>{t('Ничего не найдено')}</h3>
                          <p>{t('Попробуйте изменить запрос или сбросить фильтры.')}</p>
                          <button onClick={resetFilters}>{t('Сбросить фильтры')}</button>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="cards" lang={language}>
                        {sorted.slice(0, visibleCount).map((b) => (
                          <article key={b.id} className="card">
                            <button
                              className="card-image"
                              onClick={() => select(b.id)}
                              aria-label={t('Подробнее: ') + buildingName(b, language)}
                            >
                              <CardPhoto building={b} photoFiles={data.photoFiles} />
                              <span className="card-year">
                                <i
                                  style={{
                                    background: period(b.minYear, b.maxYear, periods)!.color,
                                  }}
                                />
                                {buildingYearLabel(b, language)}
                              </span>
                            </button>
                            <div className="card-body">
                              <span className="card-district">
                                {buildingDistrict(b, language)}
                                {!b.styleIds?.includes('undetermined') && (
                                  <> / {buildingStyle(b, language)}</>
                                )}
                              </span>
                              <button className="card-title" onClick={() => select(b.id)}>
                                {buildingName(b, language)}
                              </button>
                              <p>{b.addresses?.[language] || t('Адрес не установлен')}</p>
                              <button className="text-link" onClick={() => goMap(b.id)}>
                                {t('На карте')} <Icon name="arrow" size={15} />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                      {visibleCount < sorted.length && (
                        <div className="catalog-more">
                          <button
                            type="button"
                            onClick={() => setVisibleCount((count) => count + CATALOG_PAGE_SIZE)}
                          >
                            {t('Показать ещё')}
                          </button>
                          <span>
                            {visibleCount} / {sorted.length}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            {selectedBuilding && !inspectorHidden && (
              <Inspector
                key={selectedBuilding.id}
                building={selectedBuilding}
                city={city}
                photos={selectedPhotos}
                photoFiles={data.photoFiles}
                onClose={close}
                onMap={() => goMap(selectedBuilding.id)}
                onFilter={filterBy}
              />
            )}
          </div>
        </>
      </main>
      <div
        className={'mobile-menu-scrim' + (menuOpen ? ' open' : '')}
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
      />
      <section
        id="atlas-mobile-menu"
        className={'mobile-menu' + (menuOpen ? ' open' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="atlas-mobile-menu-title"
        ref={mobileMenu}
        inert={!menuOpen}
      >
        <div className="mobile-menu-grab" aria-hidden="true" />
        <div className="mobile-menu-head">
          <h2 id="atlas-mobile-menu-title">{t('Меню атласа')}</h2>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label={t('Закрыть меню')}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="mobile-menu-field">
          <label htmlFor="city-mobile">{t('ГОРОД')}</label>
          <select
            id="city-mobile"
            className="mobile-menu-select"
            value={city.id}
            onChange={(e) => onCityChange(e.currentTarget.value)}
          >
            {cities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.labels[language] ?? item.labels.ru ?? item.id}
              </option>
            ))}
          </select>
        </div>
        <div className="mobile-menu-field">
          <label htmlFor="language-mobile">{t('ЯЗЫК')}</label>
          <select
            id="language-mobile"
            className="mobile-menu-select"
            value={language}
            onChange={(e) => setLanguage(e.currentTarget.value as CityLanguage)}
          >
            <LanguageOptions city={city} />
          </select>
        </div>
      </section>
    </div>
  );
}
function savedLanguage(): Language {
  try {
    const saved = localStorage.getItem('atlas-language');
    return isLanguage(saved) ? saved : 'ru';
  } catch {
    return 'ru';
  }
}

function CityPlaceholder({
  city,
  fallback,
  onCityChange,
}: {
  city: CityPublic;
  fallback: CityPublic | null;
  onCityChange: (id: string) => void;
}) {
  const { t, language } = useI18n();
  return (
    <div className="city-empty">
      <h1>{city.labels[language] ?? city.labels.ru ?? city.id}</h1>
      <p>{t('Данные об архитектуре этого города пока не добавлены.')}</p>
      {fallback && fallback.id !== city.id && (
        <button onClick={() => onCityChange(fallback.id)}>
          {t('К карте')}: {fallback.labels[language] ?? fallback.labels.ru ?? fallback.id}
        </button>
      )}
    </div>
  );
}

export default function App() {
  const initial = useMemo(parseHash, []);
  const [catalog, setCatalog] = useState<CitiesCatalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [cityId, setCityId] = useState<string | null>(initial.city);
  const [cityData, setCityData] = useState<{ id: string; data: Data } | null>(null);
  const cache = useRef(new Map<string, Data>());
  const [language, setLanguageState] = useState<Language>(
    () => initial.language ?? savedLanguage(),
  );

  const setLanguage = (next: Language) => {
    const currentCity = catalog?.cities.find((item) => item.id === cityId);
    if (currentCity && !currentCity.languages.includes(next)) return;
    setLanguageState(next);
    try {
      localStorage.setItem('atlas-language', next);
    } catch {}
    const route = parseHash();
    const hash = buildHash({ ...route, city: cityId ?? route.city, language: next });
    if (location.hash !== hash) history.pushState(null, '', hash);
  };
  const t = (value: string) => translate(value, language);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function run() {
      try {
        setCatalogError('');
        const revision = import.meta.env.DEV ? String(Date.now()) : __ATLAS_REVISION__;
        const response = await fetch(`${base}cities.json?v=${encodeURIComponent(revision)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Не удалось загрузить список городов');
        const value = (await response.json()) as CitiesCatalog;
        if (!value || value.version !== 1 || !Array.isArray(value.cities) || !value.defaultCity)
          throw new Error('Неизвестный формат списка городов');
        if (!cancelled) {
          setCatalog(value);
          const desired =
            cityId && value.cities.some((city) => city.id === cityId) ? cityId : value.defaultCity;
          setCityId(desired);
          if (parseHash().city !== desired) {
            const route = parseHash();
            history.replaceState(
              null,
              '',
              buildHash({
                ...route,
                city: desired,
                building: route.city === desired ? route.building : null,
              }),
            );
          }
        }
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError'))
          setCatalogError(error instanceof Error ? error.message : 'Ошибка загрузки');
      }
    }
    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [catalogAttempt]);

  const handleReady = useCallback((data: Data) => {
    cache.current.set(data.city.id, data);
    if (cache.current.size > 3) {
      const first = cache.current.keys().next().value;
      if (first) cache.current.delete(first);
    }
    setCityData({ id: data.city.id, data });
  }, []);

  useEffect(() => {
    if (!catalog) return;
    if (!cityId) return;
    const city = catalog.cities.find((item) => item.id === cityId);
    if (!city || city.status !== 'ready') {
      setCityData(null);
      return;
    }
    const cached = cache.current.get(city.id);
    if (cached) setCityData({ id: city.id, data: cached });
    else setCityData(null);
  }, [catalog, cityId]);

  useEffect(() => {
    const pop = () => {
      const route = parseHash();
      if (route.language) setLanguageState(route.language);
      const next = route.city ?? catalog?.defaultCity ?? null;
      if (next && next !== cityId) {
        setCityId(next);
        setCityData(null);
      }
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [cityId, catalog]);

  useEffect(() => {
    if (!catalog || !cityId) return;
    const city = catalog.cities.find((item) => item.id === cityId);
    if (!city || city.languages.includes(language)) return;
    setLanguageState('ru');
    try {
      localStorage.setItem('atlas-language', 'ru');
    } catch {}
    const route = parseHash();
    const hash = buildHash({ ...route, city: city.id, language: 'ru' });
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }, [catalog, cityId, language]);

  useEffect(() => {
    const city = catalog?.cities.find((item) => item.id === cityId) ?? null;
    const suffix = t('архитектура и её истории');
    const title = city
      ? `${cityTitle(city.labels[language] ?? city.labels.ru ?? city.id, language)} — ${suffix}`
      : `${t('Архитектурный атлас')} — ${suffix}`;
    document.title = title;
    const description = city
      ? `Интерактивный атлас архитектуры ${city.labels.ru ?? city.id}: история, архитекторы и стили зданий.`
      : 'Интерактивный атлас архитектуры: история, архитекторы и стили зданий.';
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.documentElement.lang = language;
  }, [catalog, cityId, language]);

  const changeCity = (id: string) => {
    const route = parseHash();
    const nextCity = catalog?.cities.find((item) => item.id === id);
    const nextLanguage =
      nextCity && nextCity.languages.includes(language) ? language : ('ru' as Language);
    const hash = buildHash({ ...route, city: id, building: null, language: nextLanguage });
    if (location.hash !== hash) history.pushState(null, '', hash);
    if (nextLanguage !== language) {
      setLanguageState(nextLanguage);
      try {
        localStorage.setItem('atlas-language', nextLanguage);
      } catch {}
    }
    setCityId(id);
    setCityData(null);
  };

  const city = catalog?.cities.find((item) => item.id === cityId) ?? null;

  return (
    <I18nContext.Provider value={{ language, t, setLanguage }}>
      {!catalog ? (
        <CatalogLoader
          error={catalogError}
          onRetry={() => {
            setCatalogError('');
            setCatalogAttempt((value) => value + 1);
          }}
        />
      ) : city && city.status === 'coming-soon' ? (
        <CityPlaceholder
          city={city}
          fallback={catalog.cities.find((item) => item.id === catalog.defaultCity) ?? null}
          onCityChange={changeCity}
        />
      ) : city && cityData?.id === city.id ? (
        <AppContent
          key={city.id}
          data={cityData.data}
          city={city}
          cities={catalog.cities}
          onCityChange={changeCity}
        />
      ) : city ? (
        <CityLoader
          key={`${city.id}:${city.manifestRevision ?? ''}`}
          city={city}
          onReady={handleReady}
        />
      ) : (
        <CatalogLoader
          error={catalogError || 'Город не выбран'}
          onRetry={() => setCatalogAttempt((value) => value + 1)}
        />
      )}
    </I18nContext.Provider>
  );
}
