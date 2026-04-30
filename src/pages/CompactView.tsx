import { useState } from "react";
import { Link } from "react-router-dom";
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
import { ShiftSummary } from "@/components/summary/ShiftSummary";

const CompactView = () => {
  const [now] = useState(() => new Date());
  const compact = true;
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
            <div className="flex gap-4 mt-1">
               <Link to="/experiment" className="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline transition-all">
                Switch to Side-by-Side Experiment →
              </Link>
              <Link to="/original" className="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline transition-all">
                Switch to Original PIP View →
              </Link>
              <Link to="/sequence" className="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline transition-all">
                Switch to Event Sequence View →
              </Link>
            </div>
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

      <main className="mx-auto flex h-[calc(100vh-80px)] max-w-[1600px] flex-col overflow-hidden px-6 pb-4">
        {/* Top Section: Metrics + Video (65%) */}
        <div className="flex h-[65%] min-h-0 flex-col gap-4 py-4 shrink-0">
          {/* Metrics Row */}
          <div className="grid grid-cols-5 gap-4">
            {metrics.map((m) => (
              <div key={m.label} className="panel py-2 px-4">
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</div>
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-xl font-black tracking-tighter", m.color)}>{m.value}</span>
                  {m.trend !== "neutral" && (
                    <span className={cn("text-[9px] font-bold", m.trend === "up" ? "text-primary" : "text-destructive")}>
                      {m.trend === "up" ? "↑" : "↓"} 2.4%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-bold tracking-tight">Timeline Control Center</h2>
              <div className="h-3 w-px bg-border" />
              <Link to="/experiment" className="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline transition-all">
                Switch to Side-by-Side Experiment →
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">View Mode: Compact</span>
            </div>
          </div>

          <div className="flex-1 min-h-0">
             <VideoStage s={s} compact={compact} toolbar={<PlaybackToolbar s={s} />} />
          </div>
        </div>

        {/* Bottom Section: Summary (35%) */}
        <div className="h-[35%] min-h-0 border-t border-border pt-4">
           <ShiftSummary s={s} />
        </div>
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
  compact,
}: {
  s: ScrubberState;
  toolbar: React.ReactNode;
  compact: boolean;
}) {
  const selected = s.selected;
  return (
    <div className="panel relative h-full w-full overflow-hidden rounded-xl border border-border bg-surface-3 shadow-panel">
      {/* Main View: Shows event video if selected, otherwise dummy/placeholder */}
      <div className="absolute inset-0 bg-surface-3">
        {selected?.videoUrl ? (
          <img 
            key={selected.videoUrl}
            src={`/events/thumb_${selected.id}.jpg`} 
            className="h-full w-full object-cover grayscale-[0.3]"
          />
        ) : (
          <img 
            src="/events/thumb_c2.jpg" 
            className="h-full w-full object-cover grayscale-[0.3]"
          />
        )}
        <div className="absolute inset-0 scanline opacity-40 pointer-events-none" />
      </div>

      {/* Floating UI Layer */}
      <div className="absolute inset-0 z-20 p-6 flex flex-col justify-end gap-3 pointer-events-none overflow-hidden">
        {/* Top HUD Row - Still at top via justify-end behavior of the outer flex? No, I need another container for top elements if I want them at top. */}
        {/* Wait, the flex-col justify-end will push EVERYTHING to bottom. */}
        {/* I'll use absolute for the HUD. */}
        
        {/* 1. HUD & Tags (Top Row - Absolute) */}
        <div className="absolute inset-x-6 top-6 flex items-center justify-between pointer-events-none">
           <div className="flex items-center gap-3">
             <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-border bg-surface-1/90 px-3 py-1.5 shadow-sm backdrop-blur-md">
               <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
               <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground">
                 Live feed <span className="text-muted-foreground ml-1">● 4K Ultra HD</span>
               </span>
             </div>

             {/* Compact Legend Embedded at Top */}
             <div className="pointer-events-auto flex items-center gap-4 rounded-lg border border-border bg-surface-1/90 px-3 py-1.5 shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-3">
                   {(Object.keys(costCodeMeta) as CostCode[]).map(c => (
                      <div key={c} className="flex items-center gap-1.5">
                         <div 
                           className="h-2 w-2 rounded-full" 
                           style={{ background: c === 'idle' ? 'repeating-linear-gradient(45deg, #64748b, #64748b 2px, #94a3b8 2px, #94a3b8 4px)' : costCodeMeta[c].color }} 
                         />
                         <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{costCodeMeta[c].label}</span>
                      </div>
                   ))}
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex items-center gap-3">
                   {(Object.keys(eventTypeMeta) as EventType[]).map(t => (
                      <div key={t} className="flex items-center gap-1.5">
                         <div 
                           className="h-2 w-2 rounded-sm rotate-45" 
                           style={{ background: `hsl(var(${eventTypeMeta[t].cssVar}))` }} 
                         />
                         <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{eventTypeMeta[t].label}</span>
                      </div>
                   ))}
                </div>
             </div>
           </div>

           <div className="pointer-events-auto rounded-lg border border-border bg-surface-1/90 px-3 py-1.5 text-[10px] font-bold text-muted-foreground backdrop-blur-md shadow-sm uppercase tracking-widest">
             Sector 3 <span className="text-border-strong mx-1">|</span> Cam-04
           </div>
        </div>

        {/* 2. Unified Command Pane (Toolbar) */}
        <div className="pointer-events-auto">
           {toolbar}
        </div>

        {/* 3. Scrubber Timeline */}
        <div className="pointer-events-auto">
           <div className="backdrop-blur-md bg-background/40 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
             <ScrubberTimeline s={s} compact={compact} />
           </div>
        </div>
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

export default CompactView;
