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
export const safetyEvents: SafetyEvent[] = [
  { id: "e1", t: 6.6 * 3600, type: "ppe", severity: 1, label: "PPE check missed at gate" },
  { id: "e2", t: 7.1 * 3600, type: "zone", severity: 2, label: "Excavator entered restricted zone" },
  { id: "e3", t: 7.45 * 3600, type: "proximity", severity: 3, label: "Worker within 2m of swinging boom" },
  { id: "e4", t: 7.46 * 3600, type: "proximity", severity: 3, label: "Second worker enters swing radius" },
  { id: "e5", t: 8.9 * 3600, type: "speed", severity: 2, label: "Loader overspeed on haul road" },
  { id: "e6", t: 9.2 * 3600, type: "misuse", severity: 2, label: "Bucket used to push debris" },
  { id: "e7", t: 9.85 * 3600, type: "proximity", severity: 3, label: "Spotter blind-side approach" },
  { id: "e8", t: 10.4 * 3600, type: "ppe", severity: 1, label: "Hi-vis removed in active area" },
  { id: "e9", t: 11.1 * 3600, type: "speed", severity: 1, label: "Reverse speed exceeded" },
  { id: "e10", t: 13.4 * 3600, type: "misuse", severity: 3, label: "Lifting load over personnel" },
  { id: "e11", t: 13.55 * 3600, type: "proximity", severity: 2, label: "Worker close to tracks" },
  { id: "e12", t: 14.2 * 3600, type: "zone", severity: 1, label: "Stockpile zone breach" },
  { id: "e13", t: 15.8 * 3600, type: "speed", severity: 2, label: "Travel speed on grade" },
  { id: "e14", t: 16.3 * 3600, type: "misuse", severity: 2, label: "Improper bucket angle" },
  { id: "e15", t: 17.6 * 3600, type: "proximity", severity: 3, label: "Pedestrian behind loader" },
  { id: "e16", t: 18.1 * 3600, type: "ppe", severity: 1, label: "Hard hat off in cab exit" },
  { id: "e17", t: 19.4 * 3600, type: "zone", severity: 2, label: "Trench edge proximity" },
  { id: "e18", t: 19.9 * 3600, type: "proximity", severity: 3, label: "Two workers in swing radius" },
  { id: "e19", t: 20.3 * 3600, type: "misuse", severity: 2, label: "Counterweight contact risk" },
  { id: "e20", t: 20.7 * 3600, type: "speed", severity: 1, label: "Tram speed near exit" },
  // Dense burst to demo zoom clustering (around 7:27 to 7:29)
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `eb${i}`,
    t: 7.45 * 3600 + i * 18,
    type: (["proximity", "ppe", "zone", "misuse"] as EventType[])[i % 4],
    severity: ((i % 3) + 1) as 1 | 2 | 3,
    label: `Burst event #${i + 1}`,
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
