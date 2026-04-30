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

const MIN_SPAN = 30; // 30s min zoom
const MAX_SPAN = DAY_SECONDS;

function clampViewport(v: Viewport): Viewport {
  let span = Math.max(MIN_SPAN, Math.min(MAX_SPAN, v.end - v.start));
  let start = v.start;
  let end = start + span;
  if (start < 0) {
    start = 0;
    end = start + span;
  }
  if (end > DAY_SECONDS) {
    end = DAY_SECONDS;
    start = end - span;
  }
  return { start, end };
}

// Adaptive ruler ticks based on zoom span
function getTicks(vp: Viewport): { major: number[]; minor: number[]; fmt: (s: number) => string } {
  const span = vp.end - vp.start;
  let majorStep: number;
  let minorStep: number;
  let fmt: (s: number) => string;
  if (span > 12 * 3600) {
    majorStep = 3600; minorStep = 900;
    fmt = (s) => formatClock(s);
  } else if (span > 3 * 3600) {
    majorStep = 1800; minorStep = 300;
    fmt = (s) => formatClock(s);
  } else if (span > 30 * 60) {
    majorStep = 600; minorStep = 60;
    fmt = (s) => formatClock(s);
  } else if (span > 5 * 60) {
    majorStep = 60; minorStep = 10;
    fmt = (s) => formatClock(s, { showSeconds: true });
  } else {
    majorStep = 10; minorStep = 1;
    fmt = (s) => formatClock(s, { showSeconds: true });
  }
  const major: number[] = [];
  const minor: number[] = [];
  const startMajor = Math.ceil(vp.start / majorStep) * majorStep;
  for (let t = startMajor; t <= vp.end; t += majorStep) major.push(t);
  const startMinor = Math.ceil(vp.start / minorStep) * minorStep;
  for (let t = startMinor; t <= vp.end; t += minorStep) {
    if (t % majorStep !== 0) minor.push(t);
  }
  return { major, minor, fmt };
}

// ---------- shared track wrapper ------------------------------------------
function tToPct(t: number, vp: Viewport): number {
  return ((t - vp.start) / (vp.end - vp.start)) * 100;
}

// ============================================================================
// Risk track — area chart with hills/valleys
// ============================================================================
function RiskTrack({ vp, height = 64 }: { vp: Viewport; height?: number }) {
  const points = useMemo(() => {
    const visible = riskSamples.filter((s) => s.t >= vp.start - 60 && s.t <= vp.end + 60);
    return visible;
  }, [vp]);

  const path = useMemo(() => {
    if (points.length < 2) return "";
    const pts = points.map((p) => {
      const x = tToPct(p.t, vp);
      const y = (1 - p.v) * 100;
      return [x, y];
    });
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
      {/* horizontal threshold lines */}
      {[0.25, 0.5, 0.75].map((y) => (
        <div
          key={y}
          className="absolute left-0 right-0 border-t border-border/40"
          style={{ top: `${(1 - y) * 100}%` }}
        />
      ))}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
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
      <div className="pointer-events-none absolute left-2 top-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Risk profile
      </div>
      <div className="pointer-events-none absolute right-2 top-1.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-sm bg-risk-low" /> low
        <span className="inline-block h-2 w-2 rounded-sm bg-risk-med" /> med
        <span className="inline-block h-2 w-2 rounded-sm bg-risk-high" /> high
        <span className="inline-block h-2 w-2 rounded-sm bg-risk-critical" /> critical
      </div>
    </div>
  );
}

// ============================================================================
// Cost code ribbon
// ============================================================================
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

// ============================================================================
// Safety events track with clustering
// ============================================================================
function EventsTrack({
  vp,
  height = 44,
  onSelect,
  selectedId,
}: {
  vp: Viewport;
  height?: number;
  onSelect: (e: SafetyEvent) => void;
  selectedId?: string;
}) {
  // Cluster events that are within ~1.2% of viewport width.
  const span = vp.end - vp.start;
  const clusterWindow = span * 0.012;
  const visible = safetyEvents
    .filter((e) => e.t >= vp.start && e.t <= vp.end)
    .sort((a, b) => a.t - b.t);

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
      {/* baseline */}
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
            {/* stem */}
            <div
              className="mx-auto w-px"
              style={{
                height: height - top - 8,
                background: `hsl(var(${meta.cssVar}))`,
                opacity: 0.6,
              }}
            />
            {/* head */}
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

// ============================================================================
// Ruler with adaptive ticks
// ============================================================================
function Ruler({ vp }: { vp: Viewport }) {
  const { major, minor, fmt } = getTicks(vp);
  return (
    <div className="relative h-7 w-full select-none border-y border-border bg-surface-2">
      {minor.map((t) => (
        <div
          key={`mi-${t}`}
          className="absolute bottom-0 w-px bg-border"
          style={{ left: `${tToPct(t, vp)}%`, height: 6 }}
        />
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

// ============================================================================
// Minimap (always shows full 24h with viewport indicator)
// ============================================================================
function Minimap({
  vp,
  setVp,
  playhead,
}: {
  vp: Viewport;
  setVp: (v: Viewport) => void;
  playhead: number;
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

  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>Overview · 24h</span>
        <span>{formatClock(vp.start)} → {formatClock(vp.end)}</span>
      </div>
      <div
        ref={ref}
        onPointerDown={onPointerDown("scrub")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative h-12 w-full cursor-crosshair select-none overflow-hidden rounded-md border border-border bg-surface-1"
      >
        {/* mini cost ribbon */}
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
                  left: `${l}%`,
                  width: `${w}%`,
                  background: s.code === "idle" ? "hsl(var(--surface-2))" : `hsl(var(${meta.cssVar}) / 0.7)`,
                }}
              />
            );
          })}
        </div>
        {/* mini risk */}
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
        {/* event dots */}
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
        {/* playhead */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-primary-glow"
          style={{ left: `${(playhead / DAY_SECONDS) * 100}%` }}
        />
        {/* viewport window */}
        <div
          onPointerDown={onPointerDown("move")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="absolute top-0 bottom-0 cursor-grab border-2 border-primary bg-primary/10 backdrop-brightness-110 active:cursor-grabbing"
          style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
        >
          <div
            onPointerDown={onPointerDown("resize-l")}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="absolute -left-1 top-0 bottom-0 w-2 cursor-ew-resize bg-primary"
          />
          <div
            onPointerDown={onPointerDown("resize-r")}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="absolute -right-1 top-0 bottom-0 w-2 cursor-ew-resize bg-primary"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Scrubber
// ============================================================================
export function VideoScrubber() {
  const [vp, setVp] = useState<Viewport>({ start: 6 * 3600, end: 12 * 3600 });
  const [playhead, setPlayhead] = useState(7.45 * 3600);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60); // playback time multiplier
  const [selected, setSelected] = useState<SafetyEvent | undefined>(safetyEvents[2]);

  // playback loop
  const rafRef = useRef<number>();
  const lastRef = useRef<number>();
  useEffect(() => {
    if (!playing) {
      lastRef.current = undefined;
      return;
    }
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

  // wheel zoom on the timeline (zoom toward cursor)
  const stackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const span = vp.end - vp.start;
      const focus = vp.start + x * span;
      // ctrl/meta or just deltaY zooms; shift pans
      if (e.shiftKey) {
        const pan = (e.deltaY / rect.width) * span;
        setVp(clampViewport({ start: vp.start + pan, end: vp.end + pan }));
        return;
      }
      const factor = Math.exp(e.deltaY * 0.0015);
      const newSpan = Math.max(MIN_SPAN, Math.min(MAX_SPAN, span * factor));
      const newStart = focus - (focus - vp.start) * (newSpan / span);
      setVp(clampViewport({ start: newStart, end: newStart + newSpan }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [vp]);

  // click on timeline area to seek
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!stackRef.current) return;
    const rect = stackRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const t = vp.start + x * (vp.end - vp.start);
    setPlayhead(Math.max(0, Math.min(DAY_SECONDS, t)));
  };

  // drag playhead
  const phRef = useRef<{ active: boolean }>({ active: false });
  const onPlayheadDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    phRef.current.active = true;
  };
  const onPlayheadMove = (e: React.PointerEvent) => {
    if (!phRef.current.active || !stackRef.current) return;
    const rect = stackRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const t = vp.start + x * (vp.end - vp.start);
    setPlayhead(Math.max(0, Math.min(DAY_SECONDS, t)));
  };
  const onPlayheadUp = () => { phRef.current.active = false; };

  // zoom buttons
  const zoom = useCallback((factor: number) => {
    const span = vp.end - vp.start;
    const center = (vp.start + vp.end) / 2;
    const newSpan = Math.max(MIN_SPAN, Math.min(MAX_SPAN, span * factor));
    setVp(clampViewport({ start: center - newSpan / 2, end: center + newSpan / 2 }));
  }, [vp]);

  const fit = () => setVp({ start: 0, end: DAY_SECONDS });
  const focusEvent = (e: SafetyEvent) => {
    setSelected(e);
    setPlayhead(e.t);
    const span = 5 * 60; // 5 minute window
    setVp(clampViewport({ start: e.t - span / 2, end: e.t + span / 2 }));
  };

  // Show playhead inside viewport?
  const playheadInVp = playhead >= vp.start && playhead <= vp.end;
  const playheadLeft = tToPct(playhead, vp);
  const span = vp.end - vp.start;
  const zoomLabel =
    span >= 3600 ? `${(span / 3600).toFixed(1)}h` :
    span >= 60 ? `${Math.round(span / 60)}m` : `${Math.round(span)}s`;

  return (
    <div className="panel rounded-xl border border-border-strong p-4">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 font-mono text-xs font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-primary-glow glow-primary"
        >
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-2 p-1 font-mono text-[11px]">
          {[1, 30, 60, 240, 600].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={cn(
                "rounded px-2 py-1 transition",
                speed === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}×
            </button>
          ))}
        </div>
        <div className="ml-2 flex items-center gap-1 rounded-md border border-border bg-surface-2 p-1">
          <button onClick={() => zoom(0.5)} className="rounded px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-surface-3 hover:text-foreground">−</button>
          <span className="min-w-12 px-1 text-center font-mono text-[11px] text-foreground">{zoomLabel}</span>
          <button onClick={() => zoom(2)} className="rounded px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-surface-3 hover:text-foreground">+</button>
          <button onClick={fit} className="ml-1 rounded px-2 py-1 font-mono text-[11px] text-muted-foreground hover:bg-surface-3 hover:text-foreground">FIT 24h</button>
        </div>
        <div className="ml-auto flex items-center gap-3 font-mono text-xs">
          <div className="rounded-md border border-border bg-surface-2 px-3 py-1.5">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Playhead</div>
            <div className="text-base font-semibold tabular-nums text-primary-glow">
              {formatClock(playhead, { showSeconds: true })}
            </div>
          </div>
        </div>
      </div>

      {/* Stacked timeline */}
      <div
        ref={stackRef}
        onClick={handleTimelineClick}
        className="relative cursor-crosshair space-y-1"
      >
        <Ruler vp={vp} />
        <CostCodeTrack vp={vp} />
        <RiskTrack vp={vp} />
        <EventsTrack vp={vp} onSelect={focusEvent} selectedId={selected?.id} />

        {/* Playhead overlay (spans all tracks) */}
        {playheadInVp && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-30"
            style={{ left: `${playheadLeft}%` }}
          >
            <div className="absolute top-0 bottom-0 w-px bg-primary-glow shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
            <div className="absolute -left-1.5 -top-1 h-3 w-3 rotate-45 bg-primary-glow shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
          </div>
        )}
        {/* draggable playhead handle (bigger hit area) */}
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

      {/* Minimap */}
      <div className="mt-3">
        <Minimap vp={vp} setVp={(v) => setVp(clampViewport(v))} playhead={playhead} />
      </div>

      {/* Hint */}
      <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Scroll = zoom · Shift+Scroll = pan · Drag minimap window · Click to seek
      </div>
    </div>
  );
}

export { type SafetyEvent };
