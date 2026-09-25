export interface HeartRateZone {
  index: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** Lower bound as a fraction of max heart rate. */
  from: number;
  to: number;
}

export const HEART_RATE_ZONES: HeartRateZone[] = [
  { index: 1, label: "Easy", from: 0.5, to: 0.6 },
  { index: 2, label: "Steady", from: 0.6, to: 0.7 },
  { index: 3, label: "Tempo", from: 0.7, to: 0.8 },
  { index: 4, label: "Threshold", from: 0.8, to: 0.9 },
  { index: 5, label: "Max", from: 0.9, to: 1.1 },
];

export function zoneForHeartRate(bpm: number, maxHeartRate: number): HeartRateZone | null {
  if (!Number.isFinite(bpm) || bpm <= 0 || maxHeartRate <= 0) return null;
  const ratio = bpm / maxHeartRate;
  if (ratio < HEART_RATE_ZONES[0].from) return null;
  return HEART_RATE_ZONES.find((zone) => ratio >= zone.from && ratio < zone.to) ?? HEART_RATE_ZONES[4];
}

export function zoneRatio(bpm: number, maxHeartRate: number): number {
  if (maxHeartRate <= 0) return 0;
  return Math.min(1, Math.max(0, bpm / maxHeartRate));
}
