import React, { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { type ScrubberState } from "@/components/scrubber/VideoScrubber";
import { 
  checkIns as initialCheckIns, 
  safetyEvents, 
  type CheckIn, 
  type SafetyEvent, 
  formatClock, 
  formatFullDate,
  eventTypeMeta
} from "@/lib/timeline-data";

export function ShiftSummary({ s, showEventParagraph = false }: { s: ScrubberState; showEventParagraph?: boolean }) {
  const [activeTab, setActiveTab] = useState<"All" | "Morning" | "Midday" | "End of Day">("All");
  const [localCheckIns, setLocalCheckIns] = useState<CheckIn[]>(initialCheckIns);
  const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(initialCheckIns[1]?.id || null);

  useEffect(() => {
    (window as any).__addCheckIn = () => {
      const newId = `c_new_${Date.now()}`;
      const t = s.playhead;
      const newCheckIn: CheckIn = {
        id: newId,
        t,
        type: t < 12 * 3600 ? "morning" : t < 16 * 3600 ? "midday" : "evening",
        title: "Ad-hoc Supervisor Check-in",
        summary: "Manual checkpoint generated. Operational metrics captured. No immediate anomalies detected.",
        risk: "Low",
        keywords: ["manual-check", "supervisor"],
        metrics: [
          { label: "Check Time", value: formatClock(t) },
          { label: "Status", value: "Normal" },
          { label: "Alerts", value: "0" }
        ],
        eventIds: []
      };
      setLocalCheckIns(prev => [...prev, newCheckIn].sort((a, b) => a.t - b.t));
      setSelectedCheckInId(newId);
    };
    return () => { delete (window as any).__addCheckIn; };
  }, [s.playhead]);

  const handleTabChange = (tab: "All" | "Morning" | "Midday" | "End of Day") => {
    setActiveTab(tab);
    const hourRangeMap: Record<string, [number, number]> = {
      "Morning": [8.25, 12.5],
      "Midday": [12.5, 17.5],
      "End of Day": [17.5, 21],
      "All": [6, 18]
    };
    const [startH, endH] = hourRangeMap[tab];
    s.setVp({ start: startH * 3600, end: endH * 3600 });
    
    const typeMap: Record<string, string> = { "Morning": "morning", "Midday": "midday", "End of Day": "evening" };
    if (tab !== "All") {
      const first = localCheckIns.find(c => c.type === typeMap[tab]);
      if (first) {
        setSelectedCheckInId(first.id);
        s.setPlayhead(first.t);
      } else {
        setSelectedCheckInId(null);
      }
    }
  };

  const filteredCheckIns = useMemo(() => {
    if (activeTab === "All") return localCheckIns;
    const typeMap: Record<string, string> = {
      "Morning": "morning",
      "Midday": "midday",
      "End of Day": "evening"
    };
    return localCheckIns.filter(c => c.type === typeMap[activeTab]);
  }, [activeTab, localCheckIns]);

  const selectedCheckIn = useMemo(() => 
    localCheckIns.find(c => c.id === selectedCheckInId) || localCheckIns[0],
    [selectedCheckInId, localCheckIns]
  );

  const handleCheckInNow = () => {
    const now = s.playhead;
    const newCheckIn: CheckIn = {
      id: `c_new_${Date.now()}`,
      t: now,
      type: now < 12 * 3600 ? "morning" : now < 16 * 3600 ? "midday" : "evening",
      title: "Ad-hoc Supervisor Check-in",
      summary: `Manual checkpoint generated for ${formatClock(now)}. Operational metrics captured. No immediate anomalies detected in the preceding timeframe.`,
      risk: "Low",
      keywords: ["manual-check", "supervisor"],
      metrics: [
        { label: "Check Time", value: formatClock(now) },
        { label: "Status", value: "Normal" },
        { label: "Alerts", value: "0" }
      ],
      eventIds: []
    };
    setLocalCheckIns(prev => {
      const updated = [...prev, newCheckIn];
      updated.sort((a, b) => a.t - b.t);
      return updated;
    });
    setSelectedCheckInId(newCheckIn.id);
    setActiveTab("All");
  };

  return (
    <div className="flex h-full w-full gap-6 overflow-hidden">
      {/* Left Sidebar: Navigation & Events */}
      <div className="flex w-[380px] flex-col gap-4 overflow-hidden border-r border-border pr-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
          {["All", "Morning", "Midday", "End of Day"].map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab as any)}
              className={cn(
                "flex-1 rounded-md py-2 text-[10px] font-bold uppercase tracking-wider transition-all",
                activeTab === tab 
                  ? "bg-white text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Check-in Cards Scroll Area */}
        <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex items-center justify-between mb-4 mt-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Latest Check-ins</div>
            <button 
              onClick={handleCheckInNow}
              className="px-2 py-1 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest rounded transition-colors hover:bg-primary/90"
            >
              Check-in Now
            </button>
          </div>
          {filteredCheckIns.map((c) => (
            <CheckInCard 
              key={c.id} 
              checkIn={c} 
              isSelected={selectedCheckInId === c.id}
              onClick={() => {
                setSelectedCheckInId(c.id);
                s.setPlayhead(c.t);
                if (c.type === "morning") s.setVp({ start: 8.25 * 3600, end: 12.5 * 3600 });
                if (c.type === "midday") s.setVp({ start: 12.5 * 3600, end: 17.5 * 3600 });
                if (c.type === "evening") s.setVp({ start: 17.5 * 3600, end: 21 * 3600 });
              }}
            />
          ))}

          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4 mt-8">Recent Safety Events</div>
          <div className="space-y-2 pb-8">
            {safetyEvents.slice(0, 12).map((e) => (
              <EventListItem key={e.id} event={e} s={s} />
            ))}
          </div>
        </div>
      </div>

      {/* Right Content: Detail View */}
      <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
        {selectedCheckIn ? (
          <CheckInDetail checkIn={selectedCheckIn} s={s} showEventParagraph={showEventParagraph} />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Select a check-in card to view detailed analytics and sequence summaries
          </div>
        )}
      </div>
    </div>
  );
}

function CheckInCard({ 
  checkIn, 
  isSelected, 
  onClick 
}: { 
  checkIn: CheckIn; 
  isSelected: boolean; 
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full rounded-xl border p-4 text-left transition-all hover:scale-[0.98] active:scale-[0.96]",
        isSelected 
          ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
          : "border-border bg-surface-1 hover:border-primary/50 hover:bg-surface-2"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {formatClock(checkIn.t)}
        </span>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border",
          checkIn.risk === "Low" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
          checkIn.risk === "Medium" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
          "bg-rose-500/10 text-rose-500 border-rose-500/20"
        )}>
          {checkIn.risk} Risk
        </span>
      </div>
      <div className="text-[11px] font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
        {checkIn.title}
      </div>
      <div className="text-[10px] leading-relaxed text-muted-foreground line-clamp-2">
        {checkIn.summary}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[9px] font-bold text-primary/80">
        <span className="h-1 w-1 rounded-full bg-primary" />
        {checkIn.eventIds.length} EVENTS TRACKED
      </div>
    </button>
  );
}

function EventListItem({ event, s }: { event: SafetyEvent; s: ScrubberState }) {
  const isSelected = s.selected?.id === event.id;
  const ref = React.useRef<HTMLButtonElement>(null);
  
  React.useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isSelected]);
  
  return (
    <button
      ref={ref}
      onClick={() => {
        s.focusEvent(event);
      }}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-all",
        isSelected 
          ? "border-primary/40 bg-primary/5" 
          : "border-transparent hover:bg-surface-2"
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-3 overflow-hidden relative border border-border">
         <img src={`/events/thumb_${event.id}.jpg`} className="w-full h-full object-cover opacity-50" />
         <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-4 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/40">
               <div className="h-0 w-0 border-t-[3px] border-t-transparent border-l-[5px] border-l-white border-b-[3px] border-b-transparent ml-0.5" />
            </div>
         </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tabular-nums">
            {formatClock(event.t)}
          </span>
          <span className={cn(
            "h-1.5 w-1.5 rounded-full",
            event.severity === 3 ? "bg-destructive" : event.severity === 2 ? "bg-amber-500" : "bg-primary"
          )} />
        </div>
        <div className="text-[10px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
          {event.label}
        </div>
      </div>
    </button>
  );
}

function CheckInDetail({ checkIn, s, showEventParagraph }: { checkIn: CheckIn; s: ScrubberState; showEventParagraph?: boolean }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-2xl font-black tracking-tight text-foreground">{checkIn.title}</h3>
            <span className={cn(
              "rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] border",
              checkIn.risk === "Low" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
              checkIn.risk === "Medium" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
              "bg-rose-500/10 text-rose-500 border-rose-500/20"
            )}>
              Risk Grade: {checkIn.risk}
            </span>
          </div>
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            {formatFullDate(checkIn.t)} • {formatClock(checkIn.t)} • {checkIn.eventIds.length} EVENTS TRACKED
          </div>
        </div>
        <button className="flex h-10 items-center justify-center rounded-lg border border-border bg-surface-1 px-6 text-[11px] font-bold uppercase tracking-widest text-foreground hover:bg-surface-2 transition-all active:scale-95 shadow-sm">
          Export Report
        </button>
      </div>

      {/* Keywords */}
      <div className="flex items-center gap-2 mb-8">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-2">Keywords:</span>
        {checkIn.keywords.map(k => (
          <span key={k} className="rounded-md bg-surface-2 px-3 py-1 text-[10px] font-bold text-foreground border border-border">
            {k}
          </span>
        ))}
      </div>

      {/* Summary Text */}
      <div className="mb-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">Narrative Summary</div>
        <p className="text-[15px] leading-relaxed text-foreground/90 font-medium max-w-[800px]">
          {checkIn.summary}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {checkIn.metrics.map(m => (
          <div key={m.label} className="rounded-xl border border-border bg-surface-2/50 p-4">
             <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{m.label}</div>
             <div className="text-2xl font-black text-foreground tracking-tighter">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Safety Events Detail List */}
      <div className="space-y-4 pb-12">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Detailed Safety Events</div>
        {checkIn.eventIds.map((eid, idx) => {
          const event = safetyEvents.find(e => e.id === eid);
          if (!event) return null;
          return (
            <div 
              key={event.id}
              onClick={() => {
                s.focusEvent(event);
              }}
              className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-surface-1 p-3 transition-all hover:border-primary/40 hover:bg-surface-2"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-3 font-black text-muted-foreground text-sm border border-border group-hover:text-primary transition-colors">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                       <span 
                        className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white"
                        style={{ background: `hsl(var(${eventTypeMeta[event.type].cssVar}))` }}
                       >
                        {eventTypeMeta[event.type].label}
                       </span>
                       <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {formatClock(event.t)}
                       </span>
                    </div>
                    <div className="text-[13px] font-bold text-foreground">
                      {event.label}
                    </div>
                  </div>
                  <div className="h-10 w-[80px] shrink-0 rounded-lg bg-surface-3 overflow-hidden border border-border relative ml-4">
                     <img src={`/events/thumb_${event.id}.jpg`} className="w-full h-full object-cover opacity-40" />
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-5 w-5 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center border border-primary/40">
                           <div className="h-0 w-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-primary border-b-[4px] border-b-transparent ml-1" />
                        </div>
                     </div>
                  </div>
                </div>
                
                {showEventParagraph && (
                  <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground bg-surface-2/50 p-3 rounded-lg border border-border/50">
                    {generateNarrative(event)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const generateNarrative = (event: SafetyEvent) => {
  const time = formatClock(event.t, { showSeconds: true });
  switch(event.type) {
    case 'proximity': return `At ${time}, a proximity breach was detected involving heavy machinery and ground personnel. The system recorded a sustained close-quarters interaction that triggered an automatic severity ${event.severity} alert. The incident lasted for ${event.durationSec} seconds before safe distancing was restored.`;
    case 'zone': return `At ${time}, an unauthorized entry into a restricted operational zone occurred. The asset crossed the designated geo-fence boundary, generating a severity ${event.severity} geofence violation. The system tracked this incursion for ${event.durationSec} seconds before the asset cleared the area.`;
    case 'speed': return `At ${time}, a vehicle exceeded the site-specific speed limit, registering a severity ${event.severity} overspeed event. The telemetry data indicates the violation was sustained for ${event.durationSec} seconds before returning to acceptable operational limits.`;
    case 'misuse': return `At ${time}, an asset misuse anomaly was flagged by the operational monitoring system. The activity matched known improper usage signatures (severity ${event.severity}), persisting for ${event.durationSec} seconds. Immediate review of this specific operational frame is recommended.`;
    case 'ppe': return `At ${time}, computer vision identified a personal protective equipment (PPE) compliance failure. Personnel were detected without required safety gear, triggering a severity ${event.severity} alert. The non-compliant state was visible in the camera feed for ${event.durationSec} seconds.`;
    default: return `At ${time}, an operational anomaly was detected. Review the associated video feed to understand the context of this severity ${event.severity} event.`;
  }
}
