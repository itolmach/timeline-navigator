import { useMemo, useState } from "react";
import { VideoScrubber } from "@/components/scrubber/VideoScrubber";
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

  const stats = useMemo(() => {
    const byType: Record<EventType, number> = {
      proximity: 0, misuse: 0, speed: 0, zone: 0, ppe: 0,
    };
    let critical = 0;
    safetyEvents.forEach((e) => {
      byType[e.type]++;
      if (e.severity === 3) critical++;
    });
    return { total: safetyEvents.length, byType, critical };
  }, []);

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
                <span className="text-primary-glow">{stats.total}</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="text-risk-critical">{stats.critical} critical</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 p-6">
        {/* Top: Video preview + side info */}
        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <VideoPreview />
          <SidePanel stats={stats} />
        </section>

        {/* Scrubber */}
        <VideoScrubber />

        {/* Legend */}
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

function VideoPreview() {
  return (
    <div className="panel relative aspect-video overflow-hidden rounded-xl border border-border-strong">
      {/* mock camera view */}
      <div className="absolute inset-0 bg-gradient-to-br from-surface-3 via-surface-2 to-surface-1" />
      <div className="absolute inset-0 scanline opacity-60" />
      {/* horizon */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-border-strong/40" />
      {/* fake machinery silhouette */}
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

      {/* HUD overlays */}
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md border border-evt-proximity/40 bg-evt-proximity/10 px-2 py-1 backdrop-blur">
        <span className="h-2 w-2 animate-pulse rounded-full bg-evt-proximity" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-evt-proximity">
          ● REC · Proximity alert
        </span>
      </div>
      <div className="absolute right-3 top-3 rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur">
        CAM-04 · 4K · 30fps
      </div>
      <div className="absolute left-3 bottom-3 rounded-md border border-border bg-background/70 px-3 py-1.5 font-mono text-xs backdrop-blur">
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Timecode</div>
        <div className="text-base tabular-nums text-primary-glow">07:27:00</div>
      </div>
      <div className="absolute right-3 bottom-3 rounded-md border border-border bg-background/70 px-3 py-1.5 font-mono text-[10px] backdrop-blur">
        <div className="uppercase tracking-widest text-muted-foreground">Activity</div>
        <div className="flex items-center gap-1.5 text-foreground">
          <span className="h-2 w-2 rounded-sm bg-cc-digging" /> Digging
        </div>
      </div>
      {/* corner brackets */}
      {[
        "left-2 top-2 border-l-2 border-t-2",
        "right-2 top-2 border-r-2 border-t-2",
        "left-2 bottom-2 border-l-2 border-b-2",
        "right-2 bottom-2 border-r-2 border-b-2",
      ].map((c) => (
        <div key={c} className={`pointer-events-none absolute h-4 w-4 border-primary/50 ${c}`} />
      ))}
    </div>
  );
}

function SidePanel({ stats }: { stats: { total: number; byType: Record<EventType, number>; critical: number } }) {
  const selected = safetyEvents[2]; // matches default selection in scrubber
  return (
    <div className="flex flex-col gap-4">
      <div className="panel rounded-xl border border-border-strong p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Selected event
        </div>
        <div className="flex items-start gap-3">
          <div
            className="mt-1 h-3 w-3 shrink-0 rounded-full"
            style={{ background: `hsl(var(${eventTypeMeta[selected.type].cssVar}))`, boxShadow: `0 0 12px hsl(var(${eventTypeMeta[selected.type].cssVar}) / 0.7)` }}
          />
          <div>
            <div className="text-sm font-semibold text-foreground">{selected.label}</div>
            <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <span>{eventTypeMeta[selected.type].label}</span>
              <span>·</span>
              <span className="tabular-nums">{formatClock(selected.t, { showSeconds: true })}</span>
              <span>·</span>
              <span className={selected.severity === 3 ? "text-risk-critical" : selected.severity === 2 ? "text-risk-med" : "text-muted-foreground"}>
                SEV {selected.severity}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button className="rounded-md border border-border bg-surface-2 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-foreground hover:bg-surface-3">
            ◀ Prev
          </button>
          <button className="rounded-md bg-primary px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
            Replay
          </button>
          <button className="rounded-md border border-border bg-surface-2 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-foreground hover:bg-surface-3">
            Next ▶
          </button>
        </div>
      </div>

      <div className="panel rounded-xl border border-border-strong p-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Event breakdown
        </div>
        <ul className="space-y-2">
          {(Object.keys(stats.byType) as EventType[]).map((t) => {
            const meta = eventTypeMeta[t];
            const count = stats.byType[t];
            const pct = (count / stats.total) * 100;
            return (
              <li key={t}>
                <div className="mb-1 flex items-center justify-between font-mono text-[11px]">
                  <span className="flex items-center gap-2 text-foreground">
                    <span className="h-2 w-2 rounded-sm" style={{ background: `hsl(var(${meta.cssVar}))` }} />
                    {meta.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `hsl(var(${meta.cssVar}))` }} />
                </div>
              </li>
            );
          })}
        </ul>
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
