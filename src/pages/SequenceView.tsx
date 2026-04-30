import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
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
import { SkipBack, SkipForward } from "lucide-react";

const SequenceView = () => {
  const [now] = useState(() => new Date());
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
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Event Sequence Mode
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0">
             <VideoStage s={s} />
          </div>
        </div>

        {/* Bottom Section: Summary (35%) */}
        <div className="h-[35%] min-h-0 border-t border-border pt-4">
           <ShiftSummary s={s} />
        </div>
      </main>
    </div>
  );
};

function VideoStage({
  s,
}: {
  s: ScrubberState;
}) {
  const selected = s.selected;
  
  // Sequence Logic
  const sortedEvents = useMemo(() => [...safetyEvents].sort((a, b) => a.t - b.t), []);
  const currentIndex = sortedEvents.findIndex(e => e.id === selected?.id);
  
  const handlePrev = () => {
    if (currentIndex > 0) s.focusEvent(sortedEvents[currentIndex - 1]);
  };
  const handleNext = () => {
    if (currentIndex < sortedEvents.length - 1) s.focusEvent(sortedEvents[currentIndex + 1]);
  };

  return (
    <div className="panel relative h-full w-full overflow-hidden rounded-xl border border-border bg-surface-3 shadow-panel">
      {/* Main View: Shows event video if selected */}
      <div className="absolute inset-0 bg-surface-3">
        {selected?.videoUrl ? (
          <img 
            key={selected.videoUrl}
            src={`/events/thumb_${selected.id}.jpg`} 

            className="h-full w-full object-cover grayscale-[0.3]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-surface-3 via-surface-2 to-surface-1 flex items-center justify-center">
             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No Event Selected</span>
          </div>
        )}
        <div className="absolute inset-0 scanline opacity-40 pointer-events-none" />
      </div>

      {/* Floating UI Layer */}
      <div className="absolute inset-0 z-20 p-4 flex flex-col justify-end gap-3 pointer-events-none">
        
        {/* HUD Top: Compact Legend */}
        <div className="absolute inset-x-4 top-4 flex items-center justify-between pointer-events-none">
           <div className="pointer-events-auto flex items-center gap-4 rounded-lg border border-border bg-surface-1/90 px-3 py-1.5 shadow-sm backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-foreground">
                Sequence Review
              </span>
           </div>
           
           {selected && (
             <div className="pointer-events-auto rounded bg-black/60 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white backdrop-blur-md border border-white/10">
               Event {currentIndex + 1} of {sortedEvents.length}
             </div>
           )}
        </div>

        {/* Toolbar (Only Next/Prev) */}
        <div className="pointer-events-auto flex items-center justify-center">
           <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-1/90 p-1 shadow-lg backdrop-blur-md">
              <button
                onClick={handlePrev}
                disabled={currentIndex <= 0}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
              >
                <SkipBack className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Prev Event</span>
              </button>
              
              <div className="w-px h-6 bg-border mx-2" />
              
              <button
                onClick={handleNext}
                disabled={currentIndex >= sortedEvents.length - 1}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-foreground transition hover:bg-surface-2 disabled:opacity-50"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest">Next Event</span>
                <SkipForward className="h-4 w-4" />
              </button>
           </div>
        </div>

        {/* Stitched Sequence Bar */}
        <div className="pointer-events-auto px-6">
           <div className="flex h-20 w-full gap-1 rounded-xl border border-white/10 bg-background/80 p-2 shadow-2xl backdrop-blur-xl">
              {sortedEvents.map((event, idx) => {
                const isActive = idx === currentIndex;
                const meta = eventTypeMeta[event.type];
                const riskColor = event.severity === 3 ? "bg-rose-500" : event.severity === 2 ? "bg-amber-500" : "bg-emerald-500";
                
                return (
                  <button
                    key={event.id}
                    onClick={() => s.focusEvent(event)}
                    className={cn(
                      "flex-1 relative flex flex-col justify-end overflow-hidden rounded-md border transition-all group",
                      isActive 
                        ? "border-primary bg-surface-2 ring-1 ring-primary z-10 scale-[1.02] shadow-lg" 
                        : "border-border/50 bg-surface-1/50 hover:bg-surface-2 hover:border-border"
                    )}
                  >
                     {/* Top Event Color Band */}
                     <div 
                       className="absolute inset-x-0 top-0 h-1.5 opacity-80" 
                       style={{ background: `hsl(var(${meta.cssVar}))` }}
                     />
                     
                     {/* Risk Level Indicator */}
                     <div className="absolute inset-x-0 top-1.5 bottom-0 opacity-10 bg-gradient-to-b from-transparent to-current" style={{ color: `var(--${riskColor.split('-')[1]}-500)` }} />
                     
                     <div className="flex h-full w-full flex-col justify-between p-1.5 z-10">
                        <div className="flex justify-between items-start w-full">
                           <span className={cn(
                             "text-[8px] font-black uppercase",
                             isActive ? "text-foreground" : "text-muted-foreground"
                           )}>
                             {idx + 1}
                           </span>
                           <div className={cn("h-1.5 w-1.5 rounded-full shadow-sm", riskColor)} />
                        </div>
                        
                        <div className={cn(
                          "w-full transition-opacity duration-300", 
                          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}>
                           <div className="text-[8px] font-bold text-foreground truncate">{formatClock(event.t)}</div>
                        </div>
                     </div>
                  </button>
                );
              })}
           </div>
        </div>
        
      </div>
    </div>
  );
}

export default SequenceView;
