import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  PlaybackToolbar, 
  ScrubberTimeline, 
  useScrubber, 
  type ScrubberState 
} from "@/components/scrubber/VideoScrubber";
import { 
  checkIns, 
  safetyEvents, 
  CheckIn, 
  SafetyEvent, 
  formatClock, 
  formatFullDate,
  eventTypeMeta,
  costCodeMeta,
  CostCode,
  EventType
} from "@/lib/timeline-data";

const ExperimentView = () => {
  const s = useScrubber();
  const [activeTab, setActiveTab] = useState<"All" | "Morning" | "Midday" | "End of Day">("All");
  const [selectedCheckInId, setSelectedCheckInId] = useState<string>(checkIns[1].id);

  const handleTabChange = (tab: "All" | "Morning" | "Midday" | "End of Day") => {
    setActiveTab(tab);
    // Auto-zoom logic
    const hourRangeMap: Record<string, [number, number]> = {
      "Morning": [9, 12],
      "Midday": [12, 15],
      "End of Day": [15, 18],
      "All": [6, 18]
    };
    const [startH, endH] = hourRangeMap[tab];
    s.setVp({ start: startH * 3600, end: endH * 3600 });
    
    // Select the first check-in of that type if available
    const typeMap: Record<string, string> = { "Morning": "morning", "Midday": "midday", "End of Day": "evening" };
    if (tab !== "All") {
      const first = checkIns.find(c => c.type === typeMap[tab]);
      if (first) {
        setSelectedCheckInId(first.id);
        s.setPlayhead(first.t);
      }
    }
  };

  const filteredCheckIns = useMemo(() => {
    if (activeTab === "All") return checkIns;
    const typeMap: Record<string, string> = {
      "Morning": "morning",
      "Midday": "midday",
      "End of Day": "evening"
    };
    return checkIns.filter(c => c.type === typeMap[activeTab]);
  }, [activeTab]);

  const selectedCheckIn = useMemo(() => 
    checkIns.find(c => c.id === selectedCheckInId) || checkIns[0],
    [selectedCheckInId]
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground overflow-hidden">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface-1 px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-black text-white">S</div>
          <div>
            <h1 className="text-sm font-black tracking-tight">SITEOPS <span className="text-primary">ANALYTICS</span></h1>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Command Center · Side-by-Side Experiment</div>
          </div>
        </div>
        <Link to="/" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline transition-all">
          ← Back to Standard View
        </Link>
      </header>

      {/* Main Split Layout */}
      <main className="flex flex-1 overflow-hidden">
        
        {/* LEFT: Navigation & Event Feed (Scrollable) */}
        <aside className="flex w-[400px] shrink-0 flex-col border-r border-border bg-surface-1">
          <div className="p-6 border-b border-border">
             <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1 mb-6">
                {["All", "Morning", "Midday", "End of Day"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab as any)}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all",
                      activeTab === tab 
                        ? "bg-white text-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
             </div>
             
             <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Shift Timeline</div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {filteredCheckIns.map((c) => (
              <CheckInCard 
                key={c.id} 
                checkIn={c} 
                isSelected={selectedCheckInId === c.id}
                onClick={() => {
                  setSelectedCheckInId(c.id);
                  s.setPlayhead(c.t);
                }}
              />
            ))}

            <div className="pt-8 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Latest Incident Feed</div>
            <div className="space-y-2 pb-12">
               {safetyEvents.slice(0, 20).map(e => (
                 <EventListItem key={e.id} event={e} s={s} />
               ))}
            </div>
          </div>
        </aside>

        {/* RIGHT: Video & Summary Details (Integrated) */}
        <section className="flex flex-1 flex-col overflow-hidden bg-surface-3">
          
          {/* Top: Video Stage (60%) */}
          <div className="h-[60%] shrink-0 p-6 min-h-0">
             <VideoStage s={s} toolbar={<PlaybackToolbar s={s} />} />
          </div>

          {/* Bottom: Scrollable Summary Detail (40%) */}
          <div className="h-[40%] overflow-y-auto px-6 pb-12 custom-scrollbar border-t border-border bg-surface-1">
             <div className="mx-auto max-w-[1000px] w-full pt-6">
                <CheckInDetail checkIn={selectedCheckIn} s={s} />
             </div>
          </div>
        </section>
      </main>
    </div>
  );
};

// --- Sub-components (Reused or localized) ---

function CheckInCard({ checkIn, isSelected, onClick }: { checkIn: CheckIn; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full rounded-xl border p-4 text-left transition-all",
        isSelected 
          ? "border-primary bg-primary/5 shadow-md" 
          : "border-border bg-surface-2 hover:border-primary/50"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase">{formatClock(checkIn.t)}</span>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[8px] font-bold uppercase",
          checkIn.risk === "Low" ? "bg-emerald-500/10 text-emerald-500" :
          checkIn.risk === "Medium" ? "bg-amber-500/10 text-amber-500" :
          "bg-rose-500/10 text-rose-500"
        )}>
          {checkIn.risk} Risk
        </span>
      </div>
      <div className="text-[11px] font-bold text-foreground mb-1 group-hover:text-primary">{checkIn.title}</div>
      <div className="text-[10px] leading-relaxed text-muted-foreground line-clamp-2">{checkIn.summary}</div>
    </button>
  );
}

function EventListItem({ event, s }: { event: SafetyEvent; s: ScrubberState }) {
  const isSelected = s.selected?.id === event.id;
  return (
    <button
      onClick={() => { s.focusEvent(event); }}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-all",
        isSelected ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-surface-2"
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-3 font-bold text-[8px] text-muted-foreground border border-border">
         {formatClock(event.t)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-foreground truncate">{event.label}</div>
        <div className="text-[9px] text-muted-foreground uppercase">{event.type}</div>
      </div>
    </button>
  );
}

function CheckInDetail({ checkIn, s }: { checkIn: CheckIn; s: ScrubberState }) {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
       <div className="flex items-center justify-between mb-8 border-b border-border pb-6">
          <div>
            <h2 className="text-3xl font-black tracking-tighter text-foreground mb-2">{checkIn.title}</h2>
            <div className="flex items-center gap-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
               <span>{formatFullDate(checkIn.t)}</span>
               <span>•</span>
               <span>{formatClock(checkIn.t)}</span>
               <span>•</span>
               <span className="text-primary">{checkIn.risk} Risk Grade</span>
            </div>
          </div>
          <div className="flex gap-4">
             {checkIn.metrics.slice(0, 2).map(m => (
               <div key={m.label} className="text-right">
                  <div className="text-[9px] font-bold uppercase text-muted-foreground">{m.label}</div>
                  <div className="text-xl font-black text-foreground">{m.value}</div>
               </div>
             ))}
          </div>
       </div>

       <div className="grid grid-cols-3 gap-8 mb-12">
          <div className="col-span-2">
             <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Narrative Analysis</div>
             <p className="text-[15px] leading-relaxed text-foreground font-medium">{checkIn.summary}</p>
             <div className="mt-6 flex flex-wrap gap-2">
                {checkIn.keywords.map(k => (
                  <span key={k} className="rounded bg-surface-2 px-2 py-1 text-[9px] font-bold text-muted-foreground border border-border uppercase">#{k}</span>
                ))}
             </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-1 p-6">
             <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Quick Recap</div>
             <div className="aspect-video w-full rounded-lg bg-surface-3 flex items-center justify-center border border-border relative overflow-hidden group">
                <img src="/events/thumb_c2.jpg" className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                      <div className="h-0 w-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-primary border-b-[6px] border-b-transparent ml-1" />
                   </div>
                </div>
             </div>
             <div className="mt-3 text-[10px] font-bold text-center text-muted-foreground uppercase">Watch 2min Recap</div>
          </div>
       </div>

       <div className="space-y-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Safety Events Included</div>
          {checkIn.eventIds.map(eid => {
            const e = safetyEvents.find(x => x.id === eid);
            if (!e) return null;
            return (
              <div 
                key={e.id}
                onClick={() => { s.focusEvent(e); }}
                className="flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-surface-1 p-4 transition-all hover:border-primary/50 hover:shadow-sm"
              >
                 <div className={cn(
                   "h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]",
                   e.severity === 3 ? "text-rose-500" : e.severity === 2 ? "text-amber-500" : "text-emerald-500"
                 )} style={{ backgroundColor: 'currentColor' }} />
                 <div className="flex-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">{formatClock(e.t)} · {e.type}</div>
                    <div className="text-[13px] font-bold text-foreground">{e.label}</div>
                 </div>
                 <div className="text-[10px] font-bold text-primary uppercase">View Event</div>
              </div>
            );
          })}
       </div>
    </div>
  );
}

function VideoStage({ s, toolbar }: { s: ScrubberState; toolbar: React.ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border bg-black shadow-2xl ring-1 ring-white/10 group">
      <div className="absolute inset-0 bg-surface-3">
        <img 
          key={s.selected?.videoUrl || 'default'}
          src={s.selected ? `/events/thumb_${s.selected.id}.jpg` : "/events/thumb_c2.jpg"}

          className="h-full w-full object-cover grayscale-[0.3]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
      </div>

      <div className="absolute inset-0 z-20 p-6 flex flex-col justify-end gap-3 pointer-events-none">
        {/* HUD Top */}
        <div className="absolute inset-x-6 top-6 flex items-center justify-between pointer-events-none">
           <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-border bg-surface-1/90 px-3 py-1.5 shadow-sm backdrop-blur-md">
             <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
             <span className="text-[9px] font-bold uppercase tracking-widest text-foreground">Live feed</span>
           </div>
           {/* Minimal Legend */}
           <div className="pointer-events-auto flex items-center gap-4 rounded-lg border border-border bg-surface-1/90 px-3 py-1.5 shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-2">
                 <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                 <span className="text-[8px] font-bold text-muted-foreground uppercase">Safe</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                 <span className="text-[8px] font-bold text-muted-foreground uppercase">Warning</span>
              </div>
           </div>
        </div>

        {/* Toolbar */}
        <div className="pointer-events-auto">{toolbar}</div>

        {/* Scrubber */}
        <div className="pointer-events-auto">
           <div className="backdrop-blur-md bg-background/40 rounded-xl overflow-hidden border border-white/10">
             <ScrubberTimeline s={s} compact={true} />
           </div>
        </div>
      </div>
    </div>
  );
}

export default ExperimentView;
