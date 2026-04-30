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
import { Play } from "lucide-react";

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
  
  if (span > 12 * 3600) {
    majorStep = 4 * 3600; minorStep = 3600; fmt = (s) => formatClock(s);
  } else if (span > 4 * 3600) {
    majorStep = 3600; minorStep = 900; fmt = (s) => formatClock(s);
  } else if (span > 1 * 3600) {
    majorStep = 15 * 60; minorStep = 300; fmt = (s) => formatClock(s);
  } else if (span > 15 * 60) {
    majorStep = 5 * 60; minorStep = 60; fmt = (s) => formatClock(s);
  } else if (span > 3 * 60) {
    majorStep = 60; minorStep = 10; fmt = (s) => formatClock(s, { showSeconds: true });
  } else {
    majorStep = 30; minorStep = 5; fmt = (s) => formatClock(s, { showSeconds: true });
  }
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
  const span = vp.end - vp.start;
  if (span <= 0) return 0;
  return ((t - vp.start) / span) * 100;
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
  jumpToNext: () => void;
  jumpToPrev: () => void;
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

  const jumpToNext = useCallback(() => {
    const next = safetyEvents.filter(e => e.t > playhead).sort((a, b) => a.t - b.t)[0];
    if (next) focusEvent(next);
  }, [playhead, focusEvent]);

  const jumpToPrev = useCallback(() => {
    const prev = safetyEvents.filter(e => e.t < playhead - 1).sort((a, b) => b.t - a.t)[0];
    if (prev) focusEvent(prev);
  }, [playhead, focusEvent]);

  return useMemo(() => ({ 
    vp, 
    setVp, 
    playhead, 
    setPlayhead, 
    playing, 
    setPlaying, 
    speed, 
    setSpeed, 
    selected, 
    focusEvent, 
    zoom, 
    fit, 
    jumpToNext, 
    jumpToPrev 
  }), [vp, setVp, playhead, setPlayhead, playing, setPlaying, speed, setSpeed, selected, focusEvent, zoom, fit, jumpToNext, jumpToPrev]);
}

// ============================================================================
// Playback toolbar (designed to overlay on video)
// ============================================================================
export function PlaybackToolbar({ s }: { s: ScrubberState }) {
  // --- Live Data Calculations ---
  const currentRiskSample = useMemo(() => {
    const t = s.playhead;
    const idx = Math.min(Math.floor(t / 60), riskSamples.length - 1);
    return riskSamples[idx];
  }, [s.playhead]);

  const currentSegment = useMemo(() => {
    return costSegments.find(seg => s.playhead >= seg.start && s.playhead < seg.end);
  }, [s.playhead]);

  const riskValue = currentRiskSample ? currentRiskSample.v * 5 : 0;
  
  const baselineByCode: Record<CostCode, number> = {
    idle: 0.05,
    moving: 0.35,
    grading: 0.45,
    loading: 0.6,
    digging: 0.55,
  };
  const baseline = (baselineByCode[currentSegment?.code ?? "idle"] || 0) * 5;
  const riskDiff = riskValue - baseline;

  const activityDesc: Record<CostCode, string> = {
    idle: "Engine on standby, operator awaiting instructions",
    moving: "Asset in transit between work zones",
    grading: "Surface refinement and leveling in progress",
    loading: "Material transfer to haul trucks active",
    digging: "Primary excavation and trenching",
  };

  const nextEvent = useMemo(() => {
    return safetyEvents
      .filter(e => e.t > s.playhead)
      .sort((a, b) => a.t - b.t)[0];
  }, [s.playhead]);

  const timeToEventStr = useMemo(() => {
    if (!nextEvent) return "NO EVENTS";
    const diff = nextEvent.t - s.playhead;
    if (diff <= 0) return "IN PROGRESS";
    const m = Math.floor(diff / 60);
    const sec = Math.floor(diff % 60);
    return `T-${m}M ${sec}S`;
  }, [nextEvent, s.playhead]);

  return (
    <div className="flex h-12 items-center gap-4 rounded-xl border border-border bg-surface-1/95 px-3 py-1 shadow-panel backdrop-blur-md">
       {/* 1. Playback & Navigation */}
       <div className="flex items-center gap-3 border-r border-border pr-4">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => s.jumpToPrev()}
              className="flex h-7 px-3 items-center justify-center rounded-md border border-border bg-surface-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-surface-3 transition-colors active:scale-95"
            >
              Prev
            </button>
            <button 
              onClick={() => s.setPlayhead(s.selected?.t || s.playhead)}
              className="flex h-7 px-3 items-center justify-center rounded-md border border-border bg-surface-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-surface-3 transition-colors active:scale-95"
            >
              Replay
            </button>
            <button 
              onClick={() => s.jumpToNext()}
              className="flex h-7 px-3 items-center justify-center rounded-md border border-border bg-surface-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-surface-3 transition-colors active:scale-95"
            >
              Next
            </button>
          </div>

          <button
            onClick={() => s.setPlaying((p) => !p)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:bg-primary-glow shadow-md active:scale-95"
          >
            {s.playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 ml-0.5"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          <div className="flex items-center gap-1 rounded-md bg-surface-2 p-0.5 text-[9px] font-bold">
            {[1, 30, 60, 240, 600].map((sp) => (
              <button
                key={sp}
                onClick={() => s.setSpeed(sp)}
                className={cn(
                  "rounded-sm px-2 py-1 transition",
                  s.speed === sp ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {sp}×
              </button>
            ))}
          </div>
       </div>

       {/* 2. Risk Analysis + Event Details Embedded */}
       <div className="flex items-center border-r border-border pr-4 gap-4 min-w-[280px]">
          <div className="flex items-center gap-2">
             <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Risk:</span>
             <div className="flex items-baseline gap-1.5">
               <span className={cn(
                 "text-lg font-black tabular-nums tracking-tight leading-none",
                 riskValue > 3.5 ? "text-destructive" : riskValue > 2.5 ? "text-risk-med" : "text-primary"
               )}>
                 {riskValue.toFixed(2)}
               </span>
               <span className={cn(
                 "text-[9px] font-bold tabular-nums",
                 riskDiff >= 0 ? "text-destructive" : "text-primary"
               )}>
                 {riskDiff >= 0 ? "↑" : "↓"} {Math.abs(riskDiff).toFixed(2)}
               </span>
             </div>
          </div>

          {s.selected && (
             <div className="pl-4 border-l border-border flex items-center gap-3 animate-in fade-in slide-in-from-left-1 duration-300">
                <span 
                  className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
                  style={{ background: `hsl(var(${eventTypeMeta[s.selected.type].cssVar}))` }}
                >
                  {eventTypeMeta[s.selected.type].label}
                </span>
                <span className="text-[10px] font-bold text-foreground leading-tight line-clamp-1 max-w-[140px]">
                  {s.selected.label}
                </span>
             </div>
          )}
       </div>

       {/* 3. Operational State */}
       <div className="flex flex-1 items-center gap-3 overflow-hidden">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">State:</span>
          <div className="flex items-center gap-2 overflow-hidden">
            {currentSegment && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[8px] font-bold uppercase text-accent-foreground border border-primary/10 whitespace-nowrap">
                {costCodeMeta[currentSegment.code].label}
              </span>
            )}
            <span className="text-[11px] font-bold text-foreground truncate">
              {currentSegment ? activityDesc[currentSegment.code] : "Synchronizing..."}
            </span>
          </div>
       </div>

       {/* 4. Master Timeline */}
       <div className="flex items-center gap-4 border-l border-border pl-4 min-w-[140px]">
          <div className="flex flex-col items-end">
            <span className="text-[16px] font-black tabular-nums tracking-tight text-foreground leading-none">
              {formatClock(s.playhead, { showSeconds: true })}
            </span>
            <span className={cn(
              "text-[8px] font-bold uppercase tracking-widest mt-0.5",
              nextEvent ? "text-primary" : "text-muted-foreground"
            )}>
              {timeToEventStr}
            </span>
          </div>
       </div>
    </div>
  );
}

// ============================================================================
// ============================================================================
// Tracks
// ============================================================================

// ============================================================================
// Integrated Activity Track (Risk + Cost Code Combined)
// ============================================================================
function IntegratedActivityTrack({ vp, height = 80 }: { vp: Viewport; height?: number }) {
  const [hovered, setHovered] = useState<{ seg: CostSegment; idx: number } | null>(null);
  
  const points = useMemo(
    () => riskSamples.filter((s) => s.t >= vp.start - 60 && s.t <= vp.end + 60),
    [vp],
  );

  const visibleSegments = useMemo(() => 
    costSegments.map((s, i) => ({ s, i })).filter(({ s }) => s.end >= vp.start && s.start <= vp.end),
    [vp]
  );

  // Generate the baseline path for the risk chart
  const getRiskPath = useCallback((segmentStart: number, segmentEnd: number) => {
    const segPoints = points.filter(p => p.t >= segmentStart - 60 && p.t <= segmentEnd + 60);
    if (segPoints.length < 2) return "";
    
    // Create the area path
    const pts = segPoints.map((p) => [tToPct(p.t, vp), (1 - p.v) * 100]);
    let d = `M ${pts[0][0]} 100 L ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    d += ` L ${pts[pts.length - 1][0]} 100 Z`;
    return d;
  }, [points, vp]);

  const getRiskLine = useCallback((segmentStart: number, segmentEnd: number) => {
    const segPoints = points.filter(p => p.t >= segmentStart - 60 && p.t <= segmentEnd + 60);
    if (segPoints.length < 2) return "";
    const pts = segPoints.map((p) => [tToPct(p.t, vp), (1 - p.v) * 100]);
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  }, [points, vp]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border bg-surface-1" style={{ height }}>
      <div className="absolute inset-0 timeline-grid opacity-20" />
      
      {/* Grid Lines */}
      {[0.25, 0.5, 0.75].map((y) => (
        <div key={y} className="absolute left-0 right-0 border-t border-border/20" style={{ top: `${(1 - y) * 100}%` }} />
      ))}

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {visibleSegments.map(({ s, i }) => {
          const meta = costCodeMeta[s.code];
          const path = getRiskPath(s.start, s.end);
          const line = getRiskLine(s.start, s.end);
          if (!path) return null;

          return (
            <g key={i}>
              <path 
                d={path} 
                fill={`hsl(var(${meta.cssVar}) / 0.15)`}
                className="transition-colors duration-300"
              />
              <path 
                d={line} 
                fill="none" 
                stroke={`hsl(var(${meta.cssVar}))`} 
                strokeWidth="1.2" 
                vectorEffect="non-scaling-stroke" 
                className="transition-colors duration-300"
              />
            </g>
          );
        })}
      </svg>

      {/* Activity Labels Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {visibleSegments.map(({ s, i }) => {
          const left = Math.max(0, tToPct(s.start, vp));
          const right = Math.min(100, tToPct(s.end, vp));
          const width = right - left;
          if (width < 5) return null;
          const meta = costCodeMeta[s.code];
          return (
            <div 
              key={i} 
              className="absolute bottom-1 px-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 border-l border-border/30 h-3 flex items-center"
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              {width > 8 && meta.label}
            </div>
          );
        })}
      </div>

      {/* Hit areas for tooltips */}
      {visibleSegments.map(({ s, i }) => {
        const left = Math.max(0, tToPct(s.start, vp));
        const right = Math.min(100, tToPct(s.end, vp));
        return (
          <div
            key={`hit-${i}`}
            onMouseEnter={() => setHovered({ seg: s, idx: i })}
            onMouseLeave={() => setHovered(null)}
            className="absolute top-0 bottom-0 cursor-help"
            style={{ left: `${left}%`, width: `${right - left}%` }}
          />
        );
      })}

      {hovered && (
        <CostSegmentTooltip 
          segment={hovered.seg}
          before={costSegments[hovered.idx - 1]}
          after={costSegments[hovered.idx + 1]}
          position={{ left: `${tToPct((hovered.seg.start + hovered.seg.end) / 2, vp)}%` }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Cost Segment Tooltip Component
// ============================================================================
function CostSegmentTooltip({ 
  segment, 
  before, 
  after, 
  position 
}: { 
  segment: CostSegment; 
  before?: CostSegment; 
  after?: CostSegment; 
  position: { left: string } 
}) {
  const meta = costCodeMeta[segment.code];
  const dur = formatClock(segment.end - segment.start, { showSeconds: true });
  return (
    <div 
      className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 z-[100] rounded-md border border-border bg-surface-1 px-3 py-2 shadow-panel animate-in fade-in zoom-in-95 w-48"
      style={{ left: position.left }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(var(${meta.cssVar}))` }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">{meta.label}</span>
      </div>
      <div className="text-[11px] font-mono text-muted-foreground tabular-nums mb-2">
        {formatClock(segment.start)} - {formatClock(segment.end)} ({dur})
      </div>
      {(before || after) && (
        <div className="flex justify-between items-center text-[9px] uppercase tracking-wider text-muted-foreground pt-2 border-t border-border">
          {before ? <span className="truncate flex-1 text-left">&larr; {costCodeMeta[before.code].label}</span> : <span className="flex-1" />}
          {after ? <span className="truncate flex-1 text-right">{costCodeMeta[after.code].label} &rarr;</span> : <span className="flex-1" />}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Event Tooltip Component
// ============================================================================
function EventTooltip({ event, position }: { event: SafetyEvent; position: { left: string; top: number } }) {
  const meta = eventTypeMeta[event.type];
  
  return (
    <div 
      className="pointer-events-none absolute z-[100] -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface-1 shadow-panel transition-all duration-300 animate-in fade-in zoom-in-95"
      style={{ 
        left: position.left, 
        top: position.top - 140,
        width: 220
      }}
    >
      <div className="relative aspect-video w-full bg-surface-3">
        {event.videoUrl ? (
          <img 
            src={`/events/thumb_${event.id}.jpg`}

            className="h-full w-full object-cover grayscale-[0.3] brightness-90"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-3 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
            No Preview
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm border border-white/20">
            <Play className="h-3.5 w-3.5 fill-white text-white" />
          </div>
        </div>
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> REC
        </div>
      </div>
      <div className="p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span 
            className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
            style={{ background: `hsl(var(${meta.cssVar}))` }}
          >
            {meta.label}
          </span>
          <span className="font-mono text-[9px] font-bold text-primary">
            {formatClock(event.t, { showSeconds: true })}
          </span>
        </div>
        <div className="mt-1.5 text-[11px] font-semibold leading-tight text-foreground">
          {event.label}
        </div>
        {event.durationSec && (
          <div className="mt-2 flex items-center gap-1 font-mono text-[9px] text-muted-foreground uppercase tracking-widest">
            Duration <span className="text-foreground font-bold">{event.durationSec}s</span>
          </div>
        )}
      </div>
    </div>
  );
}

function EventsTrack({
  vp, height = 32, onSelect, selectedId,
}: { vp: Viewport; height?: number; onSelect: (e: SafetyEvent) => void; selectedId?: string; }) {
  const [hovered, setHovered] = useState<SafetyEvent | null>(null);
  const span = vp.end - vp.start;
  const visible = safetyEvents.filter((e) => e.t >= vp.start - 300 && e.t <= vp.end + 300).sort((a, b) => a.t - b.t);
  
  return (
    <div className="relative w-full overflow-visible rounded-lg border border-border bg-surface-1/50" style={{ height }}>
      <div className="absolute inset-0 timeline-grid opacity-10" />
      
      {visible.map((e) => {
        const left = tToPct(e.t, vp);
        // Calculate width: duration or min 5px equivalent in pct
        const pxPerSec = 1 / (span / 100); // 1% of timeline in seconds = span/100. Px per % depends on container.
        // Actually, let's just use min-width in pixels via CSS.
        const widthPct = e.durationSec ? (e.durationSec / span) * 100 : 0;
        const meta = eventTypeMeta[e.type];
        const isSelected = e.id === selectedId;
        
        if (left > 100 || left + widthPct < 0) return null;

        return (
          <button
            key={e.id}
            onClick={(evt) => { evt.stopPropagation(); onSelect(e); }}
            onMouseEnter={() => setHovered(e)}
            onMouseLeave={() => setHovered(null)}
            className={cn(
              "absolute top-1 bottom-1 rounded-sm border-l-2 transition-all group flex flex-col justify-center overflow-hidden",
              isSelected ? "z-20 ring-2 ring-primary ring-offset-1 ring-offset-background" : "z-10"
            )}
            style={{ 
              left: `${left}%`, 
              width: `calc(${widthPct}% + 4px)`, // +4px for min visible width
              minWidth: "6px",
              background: `hsl(var(${meta.cssVar}) / 0.1)`,
              borderLeftColor: `hsl(var(${meta.cssVar}))`
            }}
          >
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" 
              style={{ background: `hsl(var(${meta.cssVar}) / 0.15)` }} 
            />
            {widthPct > 5 && (
              <span className="px-1 text-[8px] font-bold uppercase truncate text-foreground/70 pointer-events-none">
                {meta.label}
              </span>
            )}
          </button>
        );
      })}

      {hovered && (
        <EventTooltip 
          event={hovered} 
          position={{ left: `${tToPct(hovered.t, vp)}%`, top: 0 }} 
        />
      )}
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
            d={useMemo(() => {
              const pts = riskSamples.map((p) => [(p.t / DAY_SECONDS) * 100, (1 - p.v) * 100]);
              let d = `M ${pts[0][0]} 100 L ${pts[0][0]} ${pts[0][1]}`;
              for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
              d += ` L ${pts[pts.length - 1][0]} 100 Z`;
              return d;
            }, [])}
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
}: { vp: Viewport; onSelect: (e: SafetyEvent) => void; selectedId?: string; }) {
  const [hovered, setHovered] = useState<SafetyEvent | CostSegment | null>(null);
  const { major, minor, fmt } = getTicks(vp);
  const span = vp.end - vp.start;
  
  const visibleEvents = safetyEvents.filter((e) => e.t >= vp.start - 300 && e.t <= vp.end + 300);
  const visibleSegments = costSegments.filter((seg) => seg.end >= vp.start && seg.start <= vp.end);
  const points = useMemo(
    () => riskSamples.filter((s) => s.t >= vp.start - 60 && s.t <= vp.end + 60),
    [vp],
  );

  const getRiskPath = useCallback((segmentStart: number, segmentEnd: number) => {
    const segPoints = points.filter(p => p.t >= segmentStart - 60 && p.t <= segmentEnd + 60);
    if (segPoints.length < 2) return "";
    const pts = segPoints.map((p) => [tToPct(p.t, vp), (1 - p.v) * 100]);
    let d = `M ${pts[0][0]} 100 L ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    d += ` L ${pts[pts.length - 1][0]} 100 Z`;
    return d;
  }, [points, vp]);

  const getRiskLine = useCallback((segmentStart: number, segmentEnd: number) => {
    const segPoints = points.filter(p => p.t >= segmentStart - 60 && p.t <= segmentEnd + 60);
    if (segPoints.length < 2) return "";
    const pts = segPoints.map((p) => [tToPct(p.t, vp), (1 - p.v) * 100]);
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  }, [points, vp]);

  return (
    <div className="flex flex-col gap-1 py-0.5">
      {/* Event Track (Rects) */}
      <div className="relative h-4 w-full overflow-visible rounded-t-lg border border-border bg-surface-1/40">
        {visibleEvents.map((e) => {
          const left = tToPct(e.t, vp);
          const widthPct = e.durationSec ? (e.durationSec / span) * 100 : 0;
          const meta = eventTypeMeta[e.type];
          const isSelected = e.id === selectedId;
          if (left > 100 || left + widthPct < 0) return null;
          return (
            <button
              key={e.id}
              onClick={(evt) => { evt.stopPropagation(); onSelect(e); }}
              onMouseEnter={() => setHovered(e)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "absolute top-0.5 bottom-0.5 rounded-sm border-l-[1.5px] transition-all",
                isSelected ? "z-20 ring-1 ring-primary" : "z-10"
              )}
              style={{ 
                left: `${left}%`, 
                width: `calc(${widthPct}% + 3px)`,
                minWidth: "4px",
                background: `hsl(var(${meta.cssVar}) / 0.15)`,
                borderLeftColor: `hsl(var(${meta.cssVar}))`
              }}
            />
          );
        })}
      </div>

      {/* Integrated Risk/Activity Bar */}
      <div className="relative h-10 w-full overflow-hidden rounded-b-lg border border-border bg-surface-1">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {visibleSegments.map((s, i) => {
            const meta = costCodeMeta[s.code];
            const path = getRiskPath(s.start, s.end);
            const line = getRiskLine(s.start, s.end);
            if (!path) return null;
            return (
              <g key={i}>
                <path d={path} fill={`hsl(var(${meta.cssVar}) / 0.15)`} />
                <path d={line} fill="none" stroke={`hsl(var(${meta.cssVar}))`} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>

        {/* Hit areas for tooltips */}
        {visibleSegments.map((s, i) => {
          const left = Math.max(0, tToPct(s.start, vp));
          const right = Math.min(100, tToPct(s.end, vp));
          return (
            <div
              key={`hit-${i}`}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(null)}
              className="absolute top-0 bottom-0 cursor-help"
              style={{ left: `${left}%`, width: `${right - left}%` }}
            />
          );
        })}
      </div>

      {/* Shared Tooltips */}
      {hovered && 'type' in hovered && (
        <EventTooltip 
          event={hovered as SafetyEvent} 
          position={{ left: `${tToPct((hovered as SafetyEvent).t, vp)}%`, top: 0 }} 
        />
      )}
      {hovered && !('type' in hovered) && (
        <CostSegmentTooltip 
          segment={hovered as CostSegment}
          before={costSegments[costSegments.indexOf(hovered as CostSegment) - 1]}
          after={costSegments[costSegments.indexOf(hovered as CostSegment) + 1]}
          position={{ left: `${tToPct(((hovered as CostSegment).start + (hovered as CostSegment).end) / 2, vp)}%` }}
        />
      )}
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

      // Priority 1: Horizontal scroll (deltaX)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const pan = (e.deltaX / rect.width) * span;
        s.setVp({ start: s.vp.start + pan, end: s.vp.end + pan });
        return;
      }

      // Priority 2: Shift + Vertical scroll (standard pan shortcut)
      if (e.shiftKey) {
        const pan = (e.deltaY / rect.width) * span;
        s.setVp({ start: s.vp.start + pan, end: s.vp.end + pan });
        return;
      }

      // Priority 3: Vertical scroll (zoom)
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
    <div className={cn("panel rounded-xl border border-border-strong", compact ? "p-2" : "p-4")}>
      <div ref={stackRef} onClick={handleTimelineClick} className={cn("relative cursor-crosshair", compact ? "" : "space-y-1")}>
        {compact ? (
          <CompactTrack vp={s.vp} onSelect={s.focusEvent} selectedId={s.selected?.id} />
        ) : (
          <>
            <Ruler vp={s.vp} />
            <div className="space-y-2 py-1">
              <EventsTrack vp={s.vp} onSelect={s.focusEvent} selectedId={s.selected?.id} />
              <IntegratedActivityTrack vp={s.vp} />
            </div>
          </>
        )}

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

      <div className={compact ? "mt-2" : "mt-3"}>
        <Minimap vp={s.vp} setVp={s.setVp} playhead={s.playhead} zoom={s.zoom} fit={s.fit} />
      </div>

      {!compact && (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Scroll = zoom · Shift+Scroll / Horiz. Scroll = pan · Drag minimap window · Click to seek
        </div>
      )}
    </div>
  );
}

export { type SafetyEvent };
