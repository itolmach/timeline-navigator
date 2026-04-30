import { useState } from "react";
import {
  PlaybackToolbar,
  ScrubberTimeline,
  useScrubber,
} from "@/components/scrubber/VideoScrubber";
import {
  costCodeMeta,
  eventTypeMeta,
  formatClock,
  safetyEvents,
  type CostCode,
  type EventType,
} from "@/lib/timeline-data";

const Index = () => {
  const [now] = useState(() => new Date());
  const s = useScrubber();
  const totalEvents = safetyEvents.length;
  const critical = safetyEvents.filter((e) => e.severity === 3).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border-strong bg-surface-1/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground glow-primary">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M4 6h12l4 4v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2"/><circle cx="11" cy="13" r="3" stroke="currentColor" strokeWidth="2"/></svg>
            </div>
            <div>
              <h1 className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-foreground">
                SiteOps · Daily Review
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Excavator EX-204 · North Pit Sector 3
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 font-mono text-xs">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Recording</div>
              <div className="tabular-nums text-foreground">{now.toISOString().slice(0, 10)} · 24h</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Events</div>
              <div className="text-foreground">
                <span className="text-primary-glow">{totalEvents}</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="text-risk-critical">{critical} critical</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 p-6">
        <VideoStage selected={s.selected} toolbar={<PlaybackToolbar s={s} />} />
        <ScrubberTimeline s={s} />
        <Legend />
      </main>

      <footer className="border-t border-border-strong bg-surface-1/40 px-6 py-4">
        <div className="mx-auto max-w-[1600px] font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Prototype · zoomable multi-track scrubber concept
        </div>
      </footer>
    </div>
  );
};

function VideoStage({
  selected,
  toolbar,
}: {
  selected: ReturnType<typeof useScrubber>["selected"];
  toolbar: React.ReactNode;
}) {
  return (
    <div className="panel relative aspect-video w-full overflow-hidden rounded-xl border border-border-strong">
      {/* Mock camera scene */}
      <div className="absolute inset-0 bg-gradient-to-br from-surface-3 via-surface-2 to-surface-1" />
      <div className="absolute inset-0 scanline opacity-60" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-border-strong/40" />
      <svg viewBox="0 0 400 225" className="absolute inset-0 h-full w-full opacity-40" preserveAspectRatio="xMidYMid meet">
        <path d="M0 180 L 80 175 L 130 160 L 200 165 L 280 155 L 400 165 L 400 225 L 0 225 Z" fill="hsl(var(--surface-3))" />
        <g fill="hsl(var(--cc-loading))" opacity="0.85">
          <rect x="180" y="120" width="60" height="32" rx="3" />
          <rect x="200" y="100" width="34" height="24" rx="3" />
          <path d="M155 152 L 245 152 L 240 168 L 160 168 Z" />
          <circle cx="175" cy="170" r="8" fill="hsl(var(--background))" />
          <circle cx="225" cy="170" r="8" fill="hsl(var(--background))" />
          <path d="M232 130 L 280 105 L 290 115 L 245 142 Z" />
        </g>
        <circle cx="115" cy="158" r="4" fill="hsl(var(--evt-proximity))" />
      </svg>

      {/* HUD: top-left status */}
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md border border-evt-proximity/40 bg-evt-proximity/10 px-2 py-1 backdrop-blur">
        <span className="h-2 w-2 animate-pulse rounded-full bg-evt-proximity" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-evt-proximity">
          ● REC · Proximity alert
        </span>
      </div>
      <div className="absolute right-3 top-3 rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur">
        CAM-04 · 4K · 30fps
      </div>

      {/* HUD: activity tag (bottom-left, sits above toolbar) */}
      <div className="absolute left-3 bottom-20 rounded-md border border-border bg-background/70 px-3 py-1.5 font-mono text-[10px] backdrop-blur">
        <div className="uppercase tracking-widest text-muted-foreground">Activity</div>
        <div className="flex items-center gap-1.5 text-foreground">
          <span className="h-2 w-2 rounded-sm bg-cc-digging" /> Digging
        </div>
      </div>

      {/* Picture-in-Picture: selected event */}
      {selected && (
        <div className="absolute right-3 top-14 w-64 overflow-hidden rounded-lg border border-border-strong bg-background/85 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between border-b border-border bg-surface-2/80 px-2.5 py-1.5">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Selected event · PiP
            </span>
            <span className="font-mono text-[9px] tabular-nums text-primary-glow">
              {formatClock(selected.t, { showSeconds: true })}
            </span>
          </div>
          {/* Mini scene preview */}
          <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-surface-3 to-surface-1">
            <div className="absolute inset-0 scanline opacity-40" />
            <svg viewBox="0 0 200 112" className="absolute inset-0 h-full w-full opacity-60" preserveAspectRatio="xMidYMid meet">
              <path d="M0 90 L 200 85 L 200 112 L 0 112 Z" fill="hsl(var(--surface-3))" />
              <rect x="80" y="55" width="40" height="22" rx="2" fill="hsl(var(--cc-loading))" />
              <circle cx="60" cy="78" r="3" fill="hsl(var(--evt-proximity))">
                <animate attributeName="r" values="3;5;3" dur="1.4s" repeatCount="indefinite" />
              </circle>
            </svg>
            <div
              className="absolute left-2 top-2 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-background"
              style={{ background: `hsl(var(${eventTypeMeta[selected.type].cssVar}))` }}
            >
              {eventTypeMeta[selected.type].label} · SEV {selected.severity}
            </div>
          </div>
          <div className="px-2.5 py-2">
            <div className="line-clamp-2 text-[12px] font-medium text-foreground">{selected.label}</div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              <button className="rounded border border-border bg-surface-2 px-1.5 py-1 font-mono text-[9px] uppercase tracking-wider text-foreground hover:bg-surface-3">◀ Prev</button>
              <button className="rounded bg-primary px-1.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-primary-foreground">Replay</button>
              <button className="rounded border border-border bg-surface-2 px-1.5 py-1 font-mono text-[9px] uppercase tracking-wider text-foreground hover:bg-surface-3">Next ▶</button>
            </div>
          </div>
        </div>
      )}

      {/* Corner brackets */}
      {[
        "left-2 top-2 border-l-2 border-t-2",
        "right-2 top-2 border-r-2 border-t-2",
        "left-2 bottom-2 border-l-2 border-b-2",
        "right-2 bottom-2 border-r-2 border-b-2",
      ].map((c) => (
        <div key={c} className={`pointer-events-none absolute h-4 w-4 border-primary/50 ${c}`} />
      ))}

      {/* Playback toolbar overlay (bottom) */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent px-4 pb-3 pt-10">
        {toolbar}
      </div>
    </div>
  );
}

function Legend() {
  const codes: CostCode[] = ["grading", "digging", "moving", "loading", "idle"];
  return (
    <div className="panel rounded-xl border border-border-strong p-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Cost codes</div>
          <div className="flex flex-wrap items-center gap-3">
            {codes.map((c) => {
              const meta = costCodeMeta[c];
              return (
                <div key={c} className="flex items-center gap-2 font-mono text-xs text-foreground">
                  <span
                    className="h-3 w-6 rounded-sm"
                    style={{
                      background:
                        c === "idle"
                          ? `repeating-linear-gradient(45deg, hsl(var(--cc-idle)) 0 4px, hsl(var(--surface-2)) 4px 8px)`
                          : `hsl(var(${meta.cssVar}))`,
                    }}
                  />
                  {meta.label}
                </div>
              );
            })}
          </div>
        </div>
        <div className="h-10 w-px bg-border" />
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Safety events</div>
          <div className="flex flex-wrap items-center gap-3">
            {(Object.keys(eventTypeMeta) as EventType[]).map((t) => {
              const meta = eventTypeMeta[t];
              return (
                <div key={t} className="flex items-center gap-2 font-mono text-xs text-foreground">
                  <span className="h-3 w-3 rounded-full" style={{ background: `hsl(var(${meta.cssVar}))` }} />
                  {meta.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Index;
