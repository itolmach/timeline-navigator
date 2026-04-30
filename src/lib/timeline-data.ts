// Mock data for a 24-hour construction site recording.
// All times are in seconds from start (0 .. 86400).

export const DAY_SECONDS = 24 * 3600;

export type CostCode = "grading" | "digging" | "moving" | "loading" | "idle";

export interface CostSegment {
  start: number;
  end: number;
  code: CostCode;
}

export type EventType = "proximity" | "misuse" | "speed" | "zone" | "ppe";

export interface SafetyEvent {
  id: string;
  t: number; // seconds
  type: EventType;
  severity: 1 | 2 | 3; // 3 = critical
  label: string;
  durationSec?: number;
  videoUrl?: string;
}

export interface RiskSample {
  t: number;
  v: number; // 0..1
}

// ---- Cost code segments ----------------------------------------------------
// Realistic-ish workday: idle overnight, ramp up morning, lunch idle, etc.
const rawSegments: Array<[number, number, CostCode]> = [
  [0, 6 * 3600, "idle"],
  [6 * 3600, 6.5 * 3600, "moving"],
  [6.5 * 3600, 8.25 * 3600, "grading"],
  [8.25 * 3600, 8.5 * 3600, "idle"],
  [8.5 * 3600, 10.75 * 3600, "digging"],
  [10.75 * 3600, 11.25 * 3600, "loading"],
  [11.25 * 3600, 12 * 3600, "moving"],
  [12 * 3600, 13 * 3600, "idle"], // lunch
  [13 * 3600, 14.5 * 3600, "digging"],
  [14.5 * 3600, 15 * 3600, "loading"],
  [15 * 3600, 15.25 * 3600, "idle"],
  [15.25 * 3600, 17 * 3600, "grading"],
  [17 * 3600, 17.5 * 3600, "moving"],
  [17.5 * 3600, 18.5 * 3600, "loading"],
  [18.5 * 3600, 19 * 3600, "idle"],
  [19 * 3600, 20.5 * 3600, "digging"],
  [20.5 * 3600, 21 * 3600, "moving"],
  [21 * 3600, DAY_SECONDS, "idle"],
];

export const costSegments: CostSegment[] = rawSegments.map(([start, end, code]) => ({ start, end, code }));

// ---- Risk samples ----------------------------------------------------------
// Generate hills/valleys with deterministic pseudo-noise.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const riskSamples: RiskSample[] = (() => {
  const rand = mulberry32(42);
  const samples: RiskSample[] = [];
  const step = 60; // sample every minute
  for (let t = 0; t <= DAY_SECONDS; t += step) {
    // Find current cost code
    const seg = costSegments.find((s) => t >= s.start && t < s.end);
    const baseByCode: Record<CostCode, number> = {
      idle: 0.05,
      moving: 0.35,
      grading: 0.45,
      loading: 0.6,
      digging: 0.55,
    };
    const base = baseByCode[seg?.code ?? "idle"];
    // smooth wave + noise
    const wave =
      0.18 * Math.sin(t / 1800) +
      0.12 * Math.sin(t / 600 + 1.3) +
      0.08 * Math.sin(t / 240);
    const noise = (rand() - 0.5) * 0.12;
    let v = base + wave + noise;
    // Add a few spikes near events
    samples.push({ t, v: Math.max(0, Math.min(1, v)) });
  }
  return samples;
})();

// ---- Safety events ---------------------------------------------------------
const CLIPS = Array.from({ length: 14 }).map((_, i) => `/events/clip_${i.toString().padStart(3, "0")}.mp4`);

export const safetyEvents: SafetyEvent[] = [
  { id: "e1", t: 6.6 * 3600, type: "ppe", severity: 1, label: "PPE check missed at gate", durationSec: 15, videoUrl: CLIPS[0] },
  { id: "e2", t: 7.1 * 3600, type: "zone", severity: 2, label: "Excavator entered restricted zone", durationSec: 45, videoUrl: CLIPS[1] },
  { id: "e3", t: 7.45 * 3600, type: "proximity", severity: 3, label: "Worker within 2m of swinging boom", durationSec: 12, videoUrl: CLIPS[2] },
  { id: "e4", t: 7.46 * 3600, type: "proximity", severity: 3, label: "Second worker enters swing radius", durationSec: 8, videoUrl: CLIPS[3] },
  { id: "e5", t: 8.9 * 3600, type: "speed", severity: 2, label: "Loader overspeed on haul road", durationSec: 25, videoUrl: CLIPS[4] },
  { id: "e6", t: 9.2 * 3600, type: "misuse", severity: 2, label: "Bucket used to push debris", durationSec: 10, videoUrl: CLIPS[5] },
  { id: "e7", t: 9.85 * 3600, type: "proximity", severity: 3, label: "Spotter blind-side approach", durationSec: 18, videoUrl: CLIPS[6] },
  { id: "e8", t: 10.4 * 3600, type: "ppe", severity: 1, label: "Hi-vis removed in active area", durationSec: 60, videoUrl: CLIPS[7] },
  { id: "e9", t: 11.1 * 3600, type: "speed", severity: 1, label: "Reverse speed exceeded", durationSec: 5, videoUrl: CLIPS[8] },
  { id: "e10", t: 13.4 * 3600, type: "misuse", severity: 3, label: "Lifting load over personnel", durationSec: 35, videoUrl: CLIPS[9] },
  { id: "e11", t: 13.55 * 3600, type: "proximity", severity: 2, label: "Worker close to tracks", durationSec: 22, videoUrl: CLIPS[10] },
  { id: "e12", t: 14.2 * 3600, type: "zone", severity: 1, label: "Stockpile zone breach", durationSec: 90, videoUrl: CLIPS[11] },
  { id: "e13", t: 15.8 * 3600, type: "speed", severity: 2, label: "Travel speed on grade", durationSec: 14, videoUrl: CLIPS[12] },
  { id: "e14", t: 16.3 * 3600, type: "misuse", severity: 2, label: "Improper bucket angle", durationSec: 11, videoUrl: CLIPS[13] },
  { id: "e15", t: 17.6 * 3600, type: "proximity", severity: 3, label: "Pedestrian behind loader", durationSec: 7, videoUrl: CLIPS[0] },
  { id: "e16", t: 18.1 * 3600, type: "ppe", severity: 1, label: "Hard hat off in cab exit", durationSec: 5, videoUrl: CLIPS[1] },
  { id: "e17", t: 19.4 * 3600, type: "zone", severity: 2, label: "Trench edge proximity", durationSec: 40, videoUrl: CLIPS[2] },
  { id: "e18", t: 19.9 * 3600, type: "proximity", severity: 3, label: "Two workers in swing radius", durationSec: 16, videoUrl: CLIPS[3] },
  { id: "e19", t: 20.3 * 3600, type: "misuse", severity: 2, label: "Counterweight contact risk", durationSec: 9, videoUrl: CLIPS[4] },
  { id: "e20", t: 20.7 * 3600, type: "speed", severity: 1, label: "Tram speed near exit", durationSec: 12, videoUrl: CLIPS[5] },
  // Dense burst to demo zoom clustering (around 7:27 to 7:29)
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `eb${i}`,
    t: 7.45 * 3600 + i * 18,
    type: (["proximity", "ppe", "zone", "misuse"] as EventType[])[i % 4],
    severity: ((i % 3) + 1) as 1 | 2 | 3,
    label: `Burst event #${i + 1}`,
    durationSec: 10 + (i * 3),
    videoUrl: CLIPS[(i + 6) % 14]
  })),
];

export const eventTypeMeta: Record<EventType, { label: string; cssVar: string }> = {
  proximity: { label: "Proximity", cssVar: "--evt-proximity" },
  misuse: { label: "Asset misuse", cssVar: "--evt-misuse" },
  speed: { label: "Overspeed", cssVar: "--evt-speed" },
  zone: { label: "Zone breach", cssVar: "--evt-zone" },
  ppe: { label: "PPE", cssVar: "--evt-ppe" },
};

export const costCodeMeta: Record<CostCode, { label: string; cssVar: string }> = {
  grading: { label: "Grading", cssVar: "--cc-grading" },
  digging: { label: "Digging", cssVar: "--cc-digging" },
  moving: { label: "Moving", cssVar: "--cc-moving" },
  loading: { label: "Loading", cssVar: "--cc-loading" },
  idle: { label: "Idle", cssVar: "--cc-idle" },
};

export interface ProductionMetric {
  label: string;
  value: string;
  trend?: string;
}

export interface CheckIn {
  id: string;
  type: "morning" | "midday" | "evening";
  t: number; // timestamp in seconds
  title: string;
  summary: string;
  risk: "Low" | "Medium" | "High";
  keywords: string[];
  metrics: ProductionMetric[];
  eventIds: string[];
}

export const checkIns: CheckIn[] = [
  {
    id: "c1",
    type: "morning",
    t: 8.25 * 3600,
    title: "Morning Startup Check-in",
    summary: "Morning shift startup concluded with all systems nominal. Initial excavation in Zone A proceeding according to plan. All operators reported for safety briefing. No critical incidents during mobilization.",
    risk: "Low",
    keywords: ["startup", "briefing", "mobilization"],
    metrics: [
      { label: "Hours Operated", value: "2.5h" },
      { label: "Efficiency", value: "94%" },
      { label: "Idle Variance", value: "-5%" }
    ],
    eventIds: ["e1", "e2", "e3", "e4"]
  },
  {
    id: "c2",
    type: "midday",
    t: 12.5 * 3600,
    title: "Midday Operational Update",
    summary: "Midday operations showed increased complexity with two proximity alerts triggered. Personnel approached active equipment zones during material transfer. Idle time increased slightly due to delivery delays in Sector 3.",
    risk: "Medium",
    keywords: ["proximity", "idle-time", "sector-3"],
    metrics: [
      { label: "Hours Operated", value: "6.0h" },
      { label: "Efficiency", value: "82%" },
      { label: "Idle Variance", value: "+12%" }
    ],
    eventIds: ["e5", "e6", "e7", "e8", "e9"]
  },
  {
    id: "c3",
    type: "evening",
    t: 17.5 * 3600,
    title: "End of Day Shift Recap",
    summary: "Shift concluded with daily earthmoving targets met. Equipment secured in parking zones. Safety briefing at 2:30 PM successfully mitigated further proximity risks. Post-operation maintenance checks completed for all primary assets.",
    risk: "Low",
    keywords: ["targets-met", "maintenance", "secured"],
    metrics: [
      { label: "Hours Operated", value: "10.5h" },
      { label: "Efficiency", value: "102%" },
      { label: "Idle Variance", value: "+4%" }
    ],
    eventIds: ["e10", "e11", "e12", "e13", "e14", "e15"]
  }
];

export function formatClock(seconds: number, opts: { showSeconds?: boolean } = {}): string {
  const s = Math.max(0, Math.min(DAY_SECONDS, seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = sec.toString().padStart(2, "0");
  return opts.showSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

export function formatFullDate(seconds: number): string {
  // Mock date for prototype
  return "April 29, 2026";
}
