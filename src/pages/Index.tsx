import { useState } from "react";
import {
  PlaybackToolbar,
  ScrubberTimeline,
  useScrubber,
  type ScrubberState,
} from "@/components/scrubber/VideoScrubber";
import {
  costCodeMeta,
  eventTypeMeta,
  formatClock,
  safetyEvents,
  type CostCode,
  type EventType,
} from "@/lib/timeline-data";
import { cn } from "@/lib/utils";

const Index = () => {
  const [now] = useState(() => new Date());
  const [compact, setCompact] = useState(true);
  const s = useScrubber();
  
  const metrics = [
    { label: "Progress", value: "73%", sub: "On track", trend: "up", color: "text-primary" },
    { label: "Schedule", value: "+1.5", sub: "Ahead of schedule", trend: "up", color: "text-primary" },
    { label: "Asset Utilization", value: "87%", sub: "Target: <5% Idle", trend: "down", color: "text-destructive" },
    { label: "Incidents", value: "0", sub: "Last 24h", trend: "neutral", color: "text-muted-foreground" },
    { label: "Warnings", value: "2", sub: "Active alerts", trend: "up", color: "text-risk-med" },
  ];

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="border-b border-border bg-surface-1 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Assets <span className="text-border-strong">/</span> John Deere 650 Bulldozer
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              John Deere 650 Bulldozer
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search for any jobsite, assets" 
                className="w-80 rounded-lg border border-border bg-surface-2 px-4 py-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-3 top-2.5 rounded border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">/</span>
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-muted-foreground hover:bg-surface-2 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </button>
          </div>
        </div>
      </header>

      {/* View Tabs */}
      <div className="border-b border-border bg-surface-1">
        <div className="mx-auto flex max-w-[1600px] items-center px-6">
          <div className="flex gap-8">
            {["Shift Overview", "Progress Report"].map((tab, i) => (
              <button 
                key={tab}
                className={cn(
                  "border-b-2 py-3 text-sm font-semibold transition-colors",
                  i === 0 ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] space-y-6 p-6">
        {/* Metrics Row */}
        <div className="grid grid-cols-5 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="panel p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={cn("text-3xl font-black tracking-tighter", m.color)}>{m.value}</span>
                {m.trend !== "neutral" && (
                  <span className={cn("text-[10px] font-bold", m.trend === "up" ? "text-primary" : "text-destructive")}>
                    {m.trend === "up" ? "↑" : "↓"} 2.4%
                  </span>
                )}
              </div>
              <div className="mt-1 text-[10px] font-medium text-muted-foreground/80">{m.sub}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Timeline Control Center</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">View Mode</span>
            <div className="inline-flex rounded-lg border border-border bg-surface-2 p-1 text-[10px] font-bold uppercase">
              <button
                onClick={() => setCompact(false)}
                className={cn("rounded-md px-4 py-1.5 transition", !compact ? "bg-surface-1 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Full
              </button>
              <button
                onClick={() => setCompact(true)}
                className={cn("rounded-md px-4 py-1.5 transition", compact ? "bg-surface-1 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Compact
              </button>
            </div>
          </div>
        </div>

        {/* Timeline moved UP (on top of video) */}
        <div className="space-y-4">
          <ScrubberTimeline s={s} compact={compact} />
        </div>

        <VideoStage s={s} toolbar={<PlaybackToolbar s={s} />} />
        
        {/* Legend always at bottom */}
        <Legend />
      </main>

      <footer className="mt-12 border-t border-border bg-surface-1 px-6 py-8">
        <div className="mx-auto max-w-[1600px] flex justify-between items-center font-medium text-[11px] text-muted-foreground">
          <div>© 2024 SiteOps Analytics Dashboard · Prototype v2.4</div>
          <div className="flex gap-6 uppercase tracking-widest">
            <a href="#" className="hover:text-primary transition-colors">Documentation</a>
            <a href="#" className="hover:text-primary transition-colors">Support</a>
            <a href="#" className="hover:text-primary transition-colors">Settings</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

function VideoStage({
  s,
  toolbar,
}: {
  s: ScrubberState;
  toolbar: React.ReactNode;
}) {
  const selected = s.selected;
  return (
    <div className="panel relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-surface-3 shadow-panel">
      {/* Mock camera scene */}
      <div className="absolute inset-0 bg-gradient-to-br from-surface-3 via-surface-2 to-surface-1" />
      <div className="absolute inset-0 scanline opacity-40" />
      
      <svg viewBox="0 0 400 225" className="absolute inset-0 h-full w-full opacity-60" preserveAspectRatio="xMidYMid meet">
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
      <div className="absolute left-4 top-4 flex items-center gap-2.5 rounded-lg border border-border bg-surface-1/90 px-3 py-1.5 shadow-sm backdrop-blur">
        <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground">
          Live feed <span className="text-muted-foreground ml-1">● 4K Ultra HD</span>
        </span>
      </div>
      
      <div className="absolute right-4 top-4 rounded-lg border border-border bg-surface-1/90 px-3 py-1.5 text-[10px] font-bold text-muted-foreground backdrop-blur shadow-sm uppercase tracking-widest">
        Sector 3 <span className="text-border-strong mx-1">|</span> Cam-04
      </div>

      {/* Picture-in-Picture: selected event */}
      {selected && (
        <div className="absolute right-4 top-16 w-72 overflow-hidden rounded-xl border border-border bg-surface-1 shadow-lg transition-all animate-in fade-in slide-in-from-right-4">
          <div className="flex items-center justify-between border-b border-border bg-surface-2 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Event Preview
            </span>
            <span className="font-mono text-[10px] font-bold tabular-nums text-primary">
              {formatClock(selected.t, { showSeconds: true })}
            </span>
          </div>
          {/* Mini scene preview */}
          <div className="relative aspect-video w-full overflow-hidden bg-surface-3">
            {selected.videoUrl ? (
              <video 
                key={selected.videoUrl}
                src={selected.videoUrl} 
                autoPlay 
                loop 
                muted 
                playsInline 
                className="h-full w-full object-cover"
              />
            ) : (
              <svg viewBox="0 0 200 112" className="absolute inset-0 h-full w-full opacity-60" preserveAspectRatio="xMidYMid meet">
                <path d="M0 90 L 200 85 L 200 112 L 0 112 Z" fill="hsl(var(--surface-3))" />
                <rect x="80" y="55" width="40" height="22" rx="2" fill="hsl(var(--cc-loading))" />
                <circle cx="60" cy="78" r="3" fill="hsl(var(--evt-proximity))">
                  <animate attributeName="r" values="3;5;3" dur="1.4s" repeatCount="indefinite" />
                </circle>
              </svg>
            )}
            <div className="absolute inset-0 scanline opacity-20 pointer-events-none" />
            <div
              className="absolute left-3 top-3 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm"
              style={{ background: `hsl(var(${eventTypeMeta[selected.type].cssVar}))` }}
            >
              {eventTypeMeta[selected.type].label}
            </div>
          </div>
          <div className="p-4">
            <div className="text-[12px] font-bold leading-tight text-foreground">{selected.label}</div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button 
                onClick={() => s.jumpToPrev()}
                className="flex items-center justify-center rounded-lg border border-border bg-surface-1 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-surface-2 transition-colors active:scale-95"
              >
                Prev
              </button>
              <button 
                onClick={() => s.setPlayhead(selected.t - 5)}
                className="flex items-center justify-center rounded-lg bg-primary py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary-glow transition-colors shadow-sm active:scale-95"
              >
                Replay
              </button>
              <button 
                onClick={() => s.jumpToNext()}
                className="flex items-center justify-center rounded-lg border border-border bg-surface-1 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-surface-2 transition-colors active:scale-95"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playback toolbar overlay (bottom) */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface-2/95 via-surface-2/40 to-transparent px-4 pb-4 pt-12">
        {toolbar}
      </div>
    </div>
  );
}

function Legend() {
  const codes: CostCode[] = ["grading", "digging", "moving", "loading", "idle"];
  return (
    <div className="panel p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Operational Status</h4>
            <span className="h-px flex-1 ml-4 bg-border/40" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
            {codes.map((c) => {
              const meta = costCodeMeta[c];
              return (
                <div key={c} className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full shadow-sm"
                    style={{
                      background:
                        c === "idle"
                          ? `repeating-linear-gradient(45deg, hsl(var(--cc-idle)) 0 2px, hsl(var(--surface-2)) 2px 4px)`
                          : `hsl(var(${meta.cssVar}))`,
                    }}
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-foreground leading-tight">{meta.label}</span>
                    <span className="text-[9px] font-medium text-muted-foreground uppercase">{c}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Incident Categories</h4>
            <span className="h-px flex-1 ml-4 bg-border/40" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
            {(Object.keys(eventTypeMeta) as EventType[]).map((t) => {
              const meta = eventTypeMeta[t];
              return (
                <div key={t} className="flex items-center gap-3">
                  <div 
                    className="h-3 w-3 rounded-sm rotate-45" 
                    style={{ background: `hsl(var(${meta.cssVar}))`, boxShadow: `0 0 10px hsl(var(${meta.cssVar}) / 0.3)` }} 
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-foreground leading-tight">{meta.label}</span>
                    <span className="text-[9px] font-medium text-muted-foreground uppercase">Severity {t === 'proximity' ? 'High' : 'Med'}</span>
                  </div>
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
