import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DAY_SECONDS,
  costSegments,
  costCodeMeta,
  eventTypeMeta,
  formatClock,
  riskSamples,
  safetyEvents,
  type SafetyEvent,
} from "@/lib/timeline-data";
import { cn } from "@/lib/utils";

// ---------- viewport math --------------------------------------------------
interface Viewport {
  start: number;
  end: number;
}

const MIN_SPAN = 30;
const MAX_SPAN = DAY_SECONDS;

function clampViewport(v: Viewport): Viewport {
  let span = Math.max(MIN_SPAN, Math.min(MAX_SPAN, v.end - v.start));
  let start = v.start;
  let end = start + span;
  if (start < 0) { start = 0; end = start + span; }
  if (end > DAY_SECONDS) { end = DAY_SECONDS; start = end - span; }
  return { start, end };
}

function getTicks(vp: Viewport): { major: number[]; minor: number[]; fmt: (s: number) => string } {
  const span = vp.end - vp.start;
  let majorStep: number; let minorStep: number; let fmt: (s: number) => string;
  if (span > 12 * 3600) { majorStep = 3600; minorStep = 900; fmt = (s) => formatClock(s); }
  else if (span > 3 * 3600) { majorStep = 1800; minorStep = 300; fmt = (s) => formatClock(s); }
  else if (span > 30 * 60) { majorStep = 600; minorStep = 60; fmt = (s) => formatClock(s); }
  else if (span > 5 * 60) { majorStep = 60; minorStep = 10; fmt = (s) => formatClock(s, { showSeconds: true }); }
  else { majorStep = 10; minorStep = 1; fmt = (s) => formatClock(s, { showSeconds: true }); }
  const major: number[] = []; const minor: number[] = [];
  const startMajor = Math.ceil(vp.start / majorStep) * majorStep;
  for (let t = startMajor; t <= vp.end; t += majorStep) major.push(t);
  const startMinor = Math.ceil(vp.start / minorStep) * minorStep;
  for (let t = startMinor; t <= vp.end; t += minorStep) {
    if (t % majorStep !== 0) minor.push(t);
  }
  return { major, minor, fmt };
}

function tToPct(t: number, vp: Viewport): number {
  return ((t - vp.start) / (vp.end - vp.start)) * 100;
}

// ============================================================================
// Shared scrubber state hook
// ============================================================================
export interface ScrubberState {
  vp: Viewport;
  setVp: (v: Viewport) => void;
  playhead: number;
  setPlayhead: (t: number) => void;
  playing: boolean;
  setPlaying: (p: boolean | ((prev: boolean) => boolean)) => void;
  speed: number;
  setSpeed: (s: number) => void;
  selected: SafetyEvent | undefined;
  focusEvent: (e: SafetyEvent) => void;
  zoom: (factor: number) => void;
  fit: () => void;
}

export function useScrubber(): ScrubberState {
  const [vp, setVpRaw] = useState<Viewport>({ start: 6 * 3600, end: 12 * 3600 });
  const [playhead, setPlayhead] = useState(7.45 * 3600);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);
  const [selected, setSelected] = useState<SafetyEvent | undefined>(safetyEvents[2]);

  const setVp = useCallback((v: Viewport) => setVpRaw(clampViewport(v)), []);

  // playback loop
  const rafRef = useRef<number>();
  const lastRef = useRef<number>();
  useEffect(() => {
    if (!playing) { lastRef.current = undefined; return; }
    const tick = (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      setPlayhead((p) => {
        const next = p + dt * speed;
        if (next >= DAY_SECONDS) { setPlaying(false); return DAY_SECONDS; }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed]);

  const zoom = useCallback((factor: number) => {
    setVpRaw((cur) => {
      const span = cur.end - cur.start;
      const center = (cur.start + cur.end) / 2;
      const newSpan = Math.max(MIN_SPAN, Math.min(MAX_SPAN, span * factor));
      return clampViewport({ start: center - newSpan / 2, end: center + newSpan / 2 });
    });
  }, []);

  const fit = useCallback(() => setVpRaw({ start: 0, end: DAY_SECONDS }), []);

  const focusEvent = useCallback((e: SafetyEvent) => {
    setSelected(e);
    setPlayhead(e.t);
    const span = 5 * 60;
    setVpRaw(clampViewport({ start: e.t - span / 2, end: e.t + span / 2 }));
  }, []);

  return { vp, setVp, playhead, setPlayhead, playing, setPlaying, speed, setSpeed, selected, focusEvent, zoom, fit };
}

// ============================================================================
// Playback toolbar (designed to overlay on video)
// ============================================================================
export function PlaybackToolbar({ s }: { s: ScrubberState }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => s.setPlaying((p) => !p)}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 font-mono text-xs font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-primary-glow glow-primary"
      >
        {s.playing ? "❚❚ Pause" : "▶ Play"}
      </button>
      <div className="flex items-center gap-1 rounded-md border border-border bg-surface-2/90 p-1 font-mono text-[11px] backdrop-blur">
        {[1, 30, 60, 240, 600].map((sp) => (
          <button
            key={sp}
            onClick={() => s.setSpeed(sp)}
            className={cn(
              "rounded px-2 py-1 transition",
              s.speed === sp ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {sp}×
          </button>
        ))}
      </div>
      <div className="ml-auto rounded-md border border-border bg-background/70 px-3 py-1.5 font-mono backdrop-blur">
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Playhead</div>
        <div className="text-base font-semibold tabular-nums text-primary-glow">
          {formatClock(s.playhead, { showSeconds: true })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tracks
// ============================================================================
function RiskTrack({ vp, height = 64 }: { vp: Viewport; height?: number }) {
  const points = useMemo(
    () => riskSamples.filter((s) => s.t >= vp.start - 60 && s.t <= vp.end + 60),
    [vp],
  );
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const pts = points.map((p) => [tToPct(p.t, vp), (1 - p.v) * 100]);
    let d = `M ${pts[0][0]} 100 L ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    d += ` L ${pts[pts.length - 1][0]} 100 Z`;
    return d;
  }, [points, vp]);
  const linePath = useMemo(() => {
    if (points.length < 2) return "";
    const pts = points.map((p) => [tToPct(p.t, vp), (1 - p.v) * 100]);
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  }, [points, vp]);

  return (
    <div className="relative w-full overflow-hidden rounded-md border border-border bg-surface-1" style={{ height }}>
      <div className="absolute inset-0 timeline-grid opacity-40" />
      {[0.25, 0.5, 0.75].map((y) => (
        <div key={y} className="absolute left-0 right-0 border-t border-border/40" style={{ top: `${(1 - y) * 100}%` }} />
      ))}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="risk-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--risk-critical))" stopOpacity="0.85" />
            <stop offset="40%" stopColor="hsl(var(--risk-high))" stopOpacity="0.55" />
            <stop offset="75%" stopColor="hsl(var(--risk-med))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--risk-low))" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <path d={path} fill="url(#risk-fill)" />
        <path d={linePath} fill="none" stroke="hsl(var(--primary-glow))" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="pointer-events-none absolute left-2 top-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Risk profile</div>
      <div className="pointer-events-none absolute right-2 top-1.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-sm bg-risk-low" /> low
        <span className="inline-block h-2 w-2 rounded-sm bg-risk-med" /> med
        <span className="inline-block h-2 w-2 rounded-sm bg-risk-high" /> high
        <span className="inline-block h-2 w-2 rounded-sm bg-risk-critical" /> critical
      </div>
    </div>
  );
}

function CostCodeTrack({ vp, height = 28 }: { vp: Viewport; height?: number }) {
  const visible = costSegments.filter((s) => s.end >= vp.start && s.start <= vp.end);
  return (
    <div className="relative w-full overflow-hidden rounded-md border border-border bg-surface-1" style={{ height }}>
      {visible.map((s, i) => {
        const left = Math.max(0, tToPct(s.start, vp));
        const right = Math.min(100, tToPct(s.end, vp));
        const width = Math.max(0, right - left);
        if (width <= 0) return null;
        const meta = costCodeMeta[s.code];
        const isIdle = s.code === "idle";
        return (
          <div
            key={i}
            className={cn(
              "absolute top-0 bottom-0 flex items-center px-2 text-[10px] font-medium uppercase tracking-wide overflow-hidden",
              isIdle ? "text-muted-foreground" : "text-background",
            )}
            style={{
              left: `${left}%`,
              width: `${width}%`,
              background: isIdle
                ? `repeating-linear-gradient(45deg, hsl(var(--cc-idle)) 0 6px, hsl(var(--surface-2)) 6px 12px)`
                : `hsl(var(${meta.cssVar}))`,
            }}
            title={`${meta.label} • ${formatClock(s.start, { showSeconds: true })} → ${formatClock(s.end, { showSeconds: true })}`}
          >
            {width > 6 && <span className="truncate font-mono">{meta.label}</span>}
          </div>
        );
      })}
    </div>
  );
}

function EventsTrack({
  vp, height = 44, onSelect, selectedId,
}: { vp: Viewport; height?: number; onSelect: (e: SafetyEvent) => void; selectedId?: string; }) {
  const span = vp.end - vp.start;
  const clusterWindow = span * 0.012;
  const visible = safetyEvents.filter((e) => e.t >= vp.start && e.t <= vp.end).sort((a, b) => a.t - b.t);
  const clusters: { items: SafetyEvent[]; t: number }[] = [];
  for (const ev of visible) {
    const last = clusters[clusters.length - 1];
    if (last && ev.t - last.t < clusterWindow) {
      last.items.push(ev);
      last.t = (last.items.reduce((a, b) => a + b.t, 0)) / last.items.length;
    } else {
      clusters.push({ items: [ev], t: ev.t });
    }
  }
  return (
    <div className="relative w-full overflow-hidden rounded-md border border-border bg-surface-1" style={{ height }}>
      <div className="absolute inset-0 timeline-grid opacity-30" />
      <div className="pointer-events-none absolute left-2 top-1 z-10 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Safety events ({visible.length})
      </div>
      <div className="absolute left-0 right-0 bottom-2 border-t border-border-strong" />
      {clusters.map((c, idx) => {
        const left = tToPct(c.t, vp);
        const isCluster = c.items.length > 1;
        const top = c.items.find((i) => i.severity === 3) ? 14 : 22;
        const dominant = c.items.reduce((a, b) => (b.severity > a.severity ? b : a));
        const meta = eventTypeMeta[dominant.type];
        const isSelected = c.items.some((i) => i.id === selectedId);
        return (
          <button
            key={idx}
            onClick={(e) => { e.stopPropagation(); onSelect(c.items[0]); }}
            className={cn(
              "group absolute -translate-x-1/2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "transition-transform duration-200",
              isSelected && "z-20 scale-110",
            )}
            style={{ left: `${left}%`, top }}
            title={isCluster ? `${c.items.length} events` : c.items[0].label}
          >
            <div className="mx-auto w-px" style={{ height: height - top - 8, background: `hsl(var(${meta.cssVar}))`, opacity: 0.6 }} />
            <div
              className={cn(
                "absolute left-1/2 -translate-x-1/2 -top-0.5 flex items-center justify-center rounded-full border-2 border-background font-mono text-[9px] font-bold text-background shadow-md",
                "group-hover:scale-125 transition-transform",
              )}
              style={{
                width: isCluster ? 18 : dominant.severity === 3 ? 12 : 10,
                height: isCluster ? 18 : dominant.severity === 3 ? 12 : 10,
                background: `hsl(var(${meta.cssVar}))`,
                boxShadow: dominant.severity === 3 ? `0 0 10px hsl(var(${meta.cssVar}) / 0.7)` : undefined,
              }}
            >
              {isCluster && c.items.length}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Ruler({ vp }: { vp: Viewport }) {
  const { major, minor, fmt } = getTicks(vp);
  return (
    <div className="relative h-7 w-full select-none border-y border-border bg-surface-2">
      {minor.map((t) => (
        <div key={`mi-${t}`} className="absolute bottom-0 w-px bg-border" style={{ left: `${tToPct(t, vp)}%`, height: 6 }} />
      ))}
      {major.map((t) => (
        <div key={`ma-${t}`} className="absolute bottom-0" style={{ left: `${tToPct(t, vp)}%` }}>
          <div className="h-3 w-px bg-border-strong" />
          <div className="absolute -translate-x-1/2 -top-0.5 font-mono text-[10px] tabular-nums text-muted-foreground" style={{ top: -16 }}>
            {fmt(t)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Minimap({
  vp, setVp, playhead, zoom, fit,
}: {
  vp: Viewport; setVp: (v: Viewport) => void; playhead: number;
  zoom: (f: number) => void; fit: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ kind: "move" | "resize-l" | "resize-r" | "scrub"; startX: number; startVp: Viewport } | null>(null);

  const onPointerDown = (kind: "move" | "resize-l" | "resize-r" | "scrub") => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { kind, startX: e.clientX, startVp: vp };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - drag.startX;
    const dt = (dx / rect.width) * DAY_SECONDS;
    if (drag.kind === "move") {
      const span = drag.startVp.end - drag.startVp.start;
      const start = drag.startVp.start + dt;
      setVp(clampViewport({ start, end: start + span }));
    } else if (drag.kind === "resize-l") {
      setVp(clampViewport({ start: drag.startVp.start + dt, end: drag.startVp.end }));
    } else if (drag.kind === "resize-r") {
      setVp(clampViewport({ start: drag.startVp.start, end: drag.startVp.end + dt }));
    } else if (drag.kind === "scrub") {
      const x = e.clientX - rect.left;
      const t = (x / rect.width) * DAY_SECONDS;
      const span = drag.startVp.end - drag.startVp.start;
      setVp(clampViewport({ start: t - span / 2, end: t + span / 2 }));
    }
  };
  const onPointerUp = () => { dragRef.current = null; };

  const left = tToPct(vp.start, { start: 0, end: DAY_SECONDS });
  const width = tToPct(vp.end, { start: 0, end: DAY_SECONDS }) - left;
  const span = vp.end - vp.start;
  const zoomLabel =
    span >= 3600 ? `${(span / 3600).toFixed(1)}h` :
    span >= 60 ? `${Math.round(span / 60)}m` : `${Math.round(span)}s`;

  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Overview · 24h <span className="ml-2 normal-case tracking-normal text-foreground/60">{formatClock(vp.start)} → {formatClock(vp.end)}</span>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-2 p-1">
          <button onClick={() => zoom(0.5)} className="rounded px-2 py-0.5 font-mono text-xs text-muted-foreground hover:bg-surface-3 hover:text-foreground">−</button>
          <span className="min-w-12 px-1 text-center font-mono text-[11px] text-foreground">{zoomLabel}</span>
          <button onClick={() => zoom(2)} className="rounded px-2 py-0.5 font-mono text-xs text-muted-foreground hover:bg-surface-3 hover:text-foreground">+</button>
          <button onClick={fit} className="ml-1 rounded px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-surface-3 hover:text-foreground">FIT 24h</button>
        </div>
      </div>
      <div
        ref={ref}
        onPointerDown={onPointerDown("scrub")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative h-12 w-full cursor-crosshair select-none overflow-hidden rounded-md border border-border bg-surface-1"
      >
        <div className="absolute inset-x-0 top-0 bottom-0">
          {costSegments.map((s, i) => {
            const l = (s.start / DAY_SECONDS) * 100;
            const w = ((s.end - s.start) / DAY_SECONDS) * 100;
            const meta = costCodeMeta[s.code];
            return (
              <div
                key={i}
                className="absolute top-0 bottom-6"
                style={{
                  left: `${l}%`, width: `${w}%`,
                  background: s.code === "idle" ? "hsl(var(--surface-2))" : `hsl(var(${meta.cssVar}) / 0.7)`,
                }}
              />
            );
          })}
        </div>
        <svg className="absolute inset-x-0 bottom-0 h-6 w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path
            d={(() => {
              const pts = riskSamples.map((p) => [(p.t / DAY_SECONDS) * 100, (1 - p.v) * 100]);
              let d = `M ${pts[0][0]} 100 L ${pts[0][0]} ${pts[0][1]}`;
              for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
              d += ` L ${pts[pts.length - 1][0]} 100 Z`;
              return d;
            })()}
            fill="hsl(var(--risk-high) / 0.5)"
          />
        </svg>
        {safetyEvents.map((e) => (
          <div
            key={e.id}
            className="absolute top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
            style={{
              left: `${(e.t / DAY_SECONDS) * 100}%`,
              background: `hsl(var(${eventTypeMeta[e.type].cssVar}))`,
              boxShadow: e.severity === 3 ? `0 0 6px hsl(var(${eventTypeMeta[e.type].cssVar}))` : undefined,
            }}
          />
        ))}
        <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-primary-glow" style={{ left: `${(playhead / DAY_SECONDS) * 100}%` }} />
        <div
          onPointerDown={onPointerDown("move")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="absolute top-0 bottom-0 cursor-grab border-2 border-primary bg-primary/10 backdrop-brightness-110 active:cursor-grabbing"
          style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
        >
          <div onPointerDown={onPointerDown("resize-l")} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="absolute -left-1 top-0 bottom-0 w-2 cursor-ew-resize bg-primary" />
          <div onPointerDown={onPointerDown("resize-r")} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="absolute -right-1 top-0 bottom-0 w-2 cursor-ew-resize bg-primary" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Compact embedded track — risk silhouette + ruler + cost strip + event pins
// ============================================================================
function CompactTrack({
  vp, onSelect, selectedId,
}: { vp: Viewport; onSelect: (e: SafetyEvent) => void; selectedId?: string }) {
  const { major, minor, fmt } = getTicks(vp);

  // monochrome risk silhouette (height = risk)
  const riskPath = useMemo(() => {
    const points = riskSamples.filter((s) => s.t >= vp.start - 60 && s.t <= vp.end + 60);
    if (points.length < 2) return "";
    const pts = points.map((p) => [tToPct(p.t, vp), (1 - p.v) * 100]);
    let d = `M ${pts[0][0]} 100 L ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    d += ` L ${pts[pts.length - 1][0]} 100 Z`;
    return d;
  }, [vp]);

  const visibleEvents = safetyEvents.filter((e) => e.t >= vp.start && e.t <= vp.end);
  const visibleSegments = costSegments.filter((s) => s.end >= vp.start && s.start <= vp.end);

  return (
    <div className="relative w-full select-none">
      {/* Risk silhouette — monochrome, height encodes risk */}
      <div className="relative h-6 w-full overflow-hidden rounded-t-md border border-b-0 border-border bg-surface-1">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={riskPath} fill="hsl(var(--foreground) / 0.55)" />
        </svg>
        <div className="pointer-events-none absolute left-1.5 top-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/80">
          Risk
        </div>
      </div>

      {/* Time bar with embedded cost strip + event pins */}
      <div className="relative h-9 w-full overflow-hidden rounded-b-md border border-border bg-surface-2">
        {/* tick marks */}
        {minor.map((t) => (
          <div key={`mi-${t}`} className="absolute top-0 w-px bg-border" style={{ left: `${tToPct(t, vp)}%`, height: 5 }} />
        ))}
        {major.map((t) => (
          <div key={`ma-${t}`} className="absolute top-0" style={{ left: `${tToPct(t, vp)}%` }}>
            <div className="h-2.5 w-px bg-border-strong" />
            <div className="absolute left-1 top-0.5 whitespace-nowrap font-mono text-[9px] tabular-nums text-muted-foreground">
              {fmt(t)}
            </div>
          </div>
        ))}

        {/* embedded event pins */}
        {visibleEvents.map((e) => {
          const meta = eventTypeMeta[e.type];
          const isSelected = e.id === selectedId;
          return (
            <button
              key={e.id}
              onClick={(ev) => { ev.stopPropagation(); onSelect(e); }}
              className={cn(
                "absolute -translate-x-1/2 cursor-pointer outline-none",
                "transition-transform hover:scale-125",
                isSelected && "z-20 scale-125",
              )}
              style={{ left: `${tToPct(e.t, vp)}%`, top: 14 }}
              title={e.label}
            >
              <div
                className="rounded-full border border-background shadow-sm"
                style={{
                  width: e.severity === 3 ? 9 : 7,
                  height: e.severity === 3 ? 9 : 7,
                  background: `hsl(var(${meta.cssVar}))`,
                  boxShadow: e.severity === 3 ? `0 0 6px hsl(var(${meta.cssVar}) / 0.8)` : undefined,
                }}
              />
            </button>
          );
        })}

        {/* 1px cost code strip embedded at the very bottom */}
        <div className="absolute inset-x-0 bottom-0 h-px">
          {visibleSegments.map((seg, i) => {
            const left = Math.max(0, tToPct(seg.start, vp));
            const right = Math.min(100, tToPct(seg.end, vp));
            const width = Math.max(0, right - left);
            if (width <= 0) return null;
            const meta = costCodeMeta[seg.code];
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: seg.code === "idle" ? "hsl(var(--cc-idle))" : `hsl(var(${meta.cssVar}))`,
                }}
                title={`${meta.label} • ${formatClock(seg.start)} → ${formatClock(seg.end)}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Timeline (tracks + minimap, no top toolbar)
// ============================================================================
export function ScrubberTimeline({ s, compact = false }: { s: ScrubberState; compact?: boolean }) {
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const span = s.vp.end - s.vp.start;
      const focus = s.vp.start + x * span;
      if (e.shiftKey) {
        const pan = (e.deltaY / rect.width) * span;
        s.setVp({ start: s.vp.start + pan, end: s.vp.end + pan });
        return;
      }
      const factor = Math.exp(e.deltaY * 0.0015);
      const newSpan = Math.max(MIN_SPAN, Math.min(MAX_SPAN, span * factor));
      const newStart = focus - (focus - s.vp.start) * (newSpan / span);
      s.setVp({ start: newStart, end: newStart + newSpan });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [s]);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!stackRef.current) return;
    const rect = stackRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const t = s.vp.start + x * (s.vp.end - s.vp.start);
    s.setPlayhead(Math.max(0, Math.min(DAY_SECONDS, t)));
  };

  const phRef = useRef<{ active: boolean }>({ active: false });
  const onPlayheadDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    phRef.current.active = true;
  };
  const onPlayheadMove = (e: React.PointerEvent) => {
    if (!phRef.current.active || !stackRef.current) return;
    const rect = stackRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const t = s.vp.start + x * (s.vp.end - s.vp.start);
    s.setPlayhead(Math.max(0, Math.min(DAY_SECONDS, t)));
  };
  const onPlayheadUp = () => { phRef.current.active = false; };

  const playheadInVp = s.playhead >= s.vp.start && s.playhead <= s.vp.end;
  const playheadLeft = tToPct(s.playhead, s.vp);

  return (
    <div className="panel rounded-xl border border-border-strong p-4">
      <div ref={stackRef} onClick={handleTimelineClick} className="relative cursor-crosshair space-y-1">
        <Ruler vp={s.vp} />
        <CostCodeTrack vp={s.vp} />
        <RiskTrack vp={s.vp} />
        <EventsTrack vp={s.vp} onSelect={s.focusEvent} selectedId={s.selected?.id} />

        {playheadInVp && (
          <div className="pointer-events-none absolute top-0 bottom-0 z-30" style={{ left: `${playheadLeft}%` }}>
            <div className="absolute top-0 bottom-0 w-px bg-primary-glow shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
            <div className="absolute -left-1.5 -top-1 h-3 w-3 rotate-45 bg-primary-glow shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
          </div>
        )}
        {playheadInVp && (
          <div
            onPointerDown={onPlayheadDown}
            onPointerMove={onPlayheadMove}
            onPointerUp={onPlayheadUp}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-0 bottom-0 z-40 w-4 -translate-x-1/2 cursor-ew-resize"
            style={{ left: `${playheadLeft}%` }}
          />
        )}
      </div>

      <div className="mt-3">
        <Minimap vp={s.vp} setVp={s.setVp} playhead={s.playhead} zoom={s.zoom} fit={s.fit} />
      </div>

      <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Scroll = zoom · Shift+Scroll = pan · Drag minimap window · Click to seek
      </div>
    </div>
  );
}

export { type SafetyEvent };
