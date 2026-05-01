import React, { useState, useEffect, useRef } from "react";
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
import { ShiftSummary, generateNarrative } from "@/components/summary/ShiftSummary";
import { Map, Video } from "lucide-react";

const MapView = () => {
  const s = useScrubber();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMapMode, setIsMapMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMinimized(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, []);

  const metrics = [
    { label: "Progress", value: "73%", sub: "On track", trend: "up", color: "text-primary" },
    { label: "Schedule", value: "+1.5", sub: "Ahead of schedule", trend: "up", color: "text-primary" },
    { label: "Asset Utilization", value: "87%", sub: "Target: <5% Idle", trend: "down", color: "text-destructive" },
    { label: "Incidents", value: "0", sub: "Last 24h", trend: "neutral", color: "text-muted-foreground" },
    { label: "Warnings", value: "2", sub: "Active alerts", trend: "up", color: "text-risk-med" },
  ];

  return (
    <div className="min-h-screen bg-background font-sans overflow-x-hidden">
      {/* Target for intersection observer to detect when we've scrolled past the header */}
      <div ref={observerTarget} className="h-px w-full absolute top-0" />

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
          
          <div className="flex items-center gap-6">
             <Link to="/" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline transition-all">
              ← Back to Main
            </Link>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-64 rounded-lg border border-border bg-surface-2 px-4 py-2 text-xs focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content (Scrolling) */}
      <main className="mx-auto max-w-[1600px] px-6">
        
        {/* Large Hero Video Section */}
        <div className={cn(
          "relative transition-all duration-700 ease-in-out py-6",
          (isMinimized && !isMapMode) ? "h-0 opacity-0 pointer-events-none mb-0 overflow-hidden" : "h-[75vh] mb-8"
        )}>
          {isMapMode ? (
            <div className="relative h-full w-full rounded-2xl border border-border bg-black shadow-2xl overflow-hidden group">
               {/* Map Placeholder */}
               <div className="absolute inset-0 bg-surface-2 flex items-center justify-center">
                 <div className="text-center opacity-50">
                   <Map className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                   <p className="font-bold uppercase tracking-widest text-muted-foreground">Mapbox Viewport Placeholder</p>
                 </div>
               </div>

               {/* Right-hand side PIP Video & Event Details */}
               <div className="absolute right-6 top-6 bottom-6 w-[450px] flex flex-col pointer-events-auto gap-4">
                 <div className="flex justify-end">
                   <button 
                     onClick={() => setIsMapMode(false)} 
                     className="flex items-center gap-2 rounded-lg border border-border bg-surface-1/90 px-3 py-1.5 shadow-sm backdrop-blur-md hover:bg-surface-2 transition-colors"
                   >
                     <Video className="w-4 h-4 text-foreground" />
                     <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Video View</span>
                   </button>
                 </div>
                 
                 <div className="w-full aspect-video shadow-2xl border border-white/20 rounded-2xl overflow-hidden bg-black flex-shrink-0">
                   <VideoStage s={s} compact={true} toolbar={null} isPip={true} hideTimeline={true} />
                 </div>

                 {s.selected && (
                   <div className="animate-in fade-in slide-in-from-top-2 flex-1 overflow-y-auto custom-scrollbar rounded-2xl border border-border bg-surface-1/90 shadow-2xl backdrop-blur-md p-5 flex flex-col gap-4">
                     <div>
                       <div className="flex items-center gap-2 mb-1.5">
                         <span 
                           className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white"
                           style={{ background: `hsl(var(${eventTypeMeta[s.selected.type].cssVar}))` }}
                         >
                           {eventTypeMeta[s.selected.type].label}
                         </span>
                         <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                           {formatClock(s.selected.t)}
                         </span>
                       </div>
                       <h3 className="text-sm font-bold text-foreground leading-snug">
                         {s.selected.label}
                       </h3>
                     </div>
                     <div className="text-[12px] leading-relaxed text-muted-foreground bg-surface-2/50 p-4 rounded-xl border border-border/50">
                       {generateNarrative(s.selected)}
                     </div>
                   </div>
                 )}
               </div>

               {/* Timeline Floating Above Map View (outside of PiP) */}
               <div className="absolute left-6 right-[498px] bottom-6 z-50 pointer-events-auto">
                 <PlaybackToolbar s={s} />
                 <div className="mt-3 backdrop-blur-md bg-background/40 overflow-hidden shadow-2xl border rounded-xl border-white/10">
                   <ScrubberTimeline s={s} />
                 </div>
               </div>
            </div>
          ) : (
            <VideoStage s={s} toolbar={<PlaybackToolbar s={s} />} onToggleMap={() => setIsMapMode(true)} />
          )}
        </div>

        {/* Floating PIP Video (Visible when scrolled down AND not in map mode) */}
        {!isMapMode && (
          <div className={cn(
            "fixed bottom-8 right-8 z-[100] w-[450px] aspect-video transition-all duration-500 ease-in-out transform shadow-2xl border border-white/20 rounded-2xl overflow-hidden bg-black",
            isMinimized 
              ? "translate-y-0 opacity-100 scale-100" 
              : "translate-y-20 opacity-0 scale-90 pointer-events-none"
          )}>
             <VideoStage s={s} compact={true} toolbar={null} isPip={true} />
          </div>
        )}



        {/* Summary Content Section */}
        <div className="pb-24">
           {/* Metrics Row (Small) */}
           <div className="grid grid-cols-5 gap-4 mb-12">
            {metrics.map((m) => (
              <div key={m.label} className="panel py-3 px-5 border border-border bg-surface-1/50">
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{m.label}</div>
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-xl font-black tracking-tighter", m.color)}>{m.value}</span>
                  <span className="text-[9px] font-bold text-primary">↑ 2.4%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-border bg-surface-1 p-8 shadow-sm">
             <div className="mb-8 flex items-center justify-between">
                <div>
                   <h2 className="text-3xl font-black tracking-tighter">Shift Narrative & Summary</h2>
                   <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest mt-1">Operational Review for April 30, 2026</p>
                </div>
             </div>
             
             <div className="h-[1200px]"> {/* High height to ensure scrolling for demo */}
                <ShiftSummary s={s} showEventParagraph={true} />
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

function VideoStage({ 
  s, 
  toolbar, 
  compact = false,
  isPip = false,
  hideTimeline = false,
  onToggleMap
}: { 
  s: ScrubberState; 
  toolbar?: React.ReactNode;
  compact?: boolean;
  isPip?: boolean;
  hideTimeline?: boolean;
  onToggleMap?: () => void;
}) {
  const selected = s.selected;
  return (
    <div className={cn(
      "relative h-full w-full overflow-hidden rounded-2xl border border-border bg-black shadow-2xl ring-1 ring-white/10 group",
      isPip && "border-white/10 ring-0 shadow-none rounded-none"
    )}>
      {/* Main View */}
      <div className="absolute inset-0 bg-surface-3">
        {selected?.videoUrl ? (
          <video
            key={selected.videoUrl}
            src={selected.videoUrl} 
            className="h-full w-full object-cover grayscale-[0.3]"
            autoPlay
            muted
            loop
            playsInline
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
      <div className={cn(
        "absolute inset-0 z-20 p-6 flex flex-col justify-end gap-3 pointer-events-none overflow-hidden",
        isPip && "p-3"
      )}>
        {!isPip && (
          <div className="absolute inset-x-6 top-6 flex items-start justify-between pointer-events-none">
             <div className="flex items-center gap-3">
               <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-border bg-surface-1/90 px-3 py-1.5 shadow-sm backdrop-blur-md">
                 <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                 <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground">
                   Live feed <span className="text-muted-foreground ml-1">● 4K Ultra HD</span>
                 </span>
               </div>
             </div>

             {onToggleMap && (
               <button 
                 onClick={onToggleMap} 
                 className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-surface-1/90 px-3 py-1.5 shadow-sm backdrop-blur-md hover:bg-surface-2 transition-colors"
               >
                 <Map className="w-4 h-4 text-foreground" />
                 <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Map View</span>
               </button>
             )}
          </div>
        )}

        {/* PIP Title Overlay */}
        {isPip && (
          <div className="absolute inset-x-4 top-4 flex items-center justify-between pointer-events-none">
             <div className="rounded bg-black/60 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-white backdrop-blur-md border border-white/10">
               {selected?.label || "Monitoring"}
             </div>
          </div>
        )}

        {/* Toolbar */}
        {!isPip && toolbar && <div className="pointer-events-auto">{toolbar}</div>}

        {/* Scrubber Timeline */}
        {!hideTimeline && (
          <div className="pointer-events-auto">
             <div className={cn("backdrop-blur-md bg-background/40 overflow-hidden shadow-2xl border", isPip ? "rounded-lg border-white/5" : "rounded-xl border-white/10")}>
               <ScrubberTimeline s={s} compact={isPip ? true : compact} />
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MapView;
