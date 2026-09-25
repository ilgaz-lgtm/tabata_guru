import type { HeartRateSample, HrvSample } from "@/lib/biometrics/types";
import type { RoundResponse, SessionLog } from "./types";

/**
 * Per-round physiological response, derived purely from the recorded phase
 * markers and the sample series. Every metric is optional: with no strap
 * connected the rounds still exist, they simply carry no heart-rate data.
 */

interface Window {
  from: number;
  to: number;
}

export function roundResponses(log: SessionLog): RoundResponse[] {
  const end = log.endedAt ?? Number.POSITIVE_INFINITY;
  const responses = new Map<string, RoundResponse>();

  log.markers.forEach((marker, index) => {
    if (marker.round === null) return;
    if (marker.kind !== "work" && marker.kind !== "rest") return;

    const window: Window = {
      from: marker.timestamp,
      to: log.markers[index + 1]?.timestamp ?? end,
    };
    const key = `${marker.set ?? 1}-${marker.round}`;
    const response: RoundResponse = responses.get(key) ?? {
      round: marker.round,
      set: marker.set ?? 1,
      workStartBpm: null,
      peakBpm: null,
      restStartBpm: null,
      restEndBpm: null,
      recoveryDropBpm: null,
      rmssd: null,
    };

    const beats = samplesIn(log.heartRate, window);
    if (marker.kind === "work") {
      response.workStartBpm = beats[0]?.bpm ?? null;
      response.peakBpm = beats.length
        ? Math.max(...beats.map((sample) => sample.bpm))
        : null;
    } else {
      response.restStartBpm = beats[0]?.bpm ?? null;
      // The lowest reading of the rest interval: the point the heart actually
      // recovered to, rather than whatever the final packet happened to carry.
      response.restEndBpm = beats.length
        ? Math.min(...beats.map((sample) => sample.bpm))
        : null;
      if (response.restStartBpm !== null && response.restEndBpm !== null) {
        response.recoveryDropBpm = response.restStartBpm - response.restEndBpm;
      }
      const hrv = samplesIn(log.hrv, window).at(-1);
      if (hrv) response.rmssd = Math.round(hrv.rmssd * 10) / 10;
    }

    responses.set(key, response);
  });

  return [...responses.values()].sort(
    (a, b) => a.set - b.set || a.round - b.round,
  );
}

/** Rounds whose work interval was actually entered. */
export function roundsStarted(log: SessionLog): number {
  return log.markers.filter((marker) => marker.kind === "work").length;
}

export function bestRecovery(rounds: RoundResponse[]): RoundResponse | null {
  return rounds.reduce<RoundResponse | null>((best, round) => {
    if (round.recoveryDropBpm === null) return best;
    if (best?.recoveryDropBpm == null) return round;
    return round.recoveryDropBpm > best.recoveryDropBpm ? round : best;
  }, null);
}

function samplesIn<T extends HeartRateSample | HrvSample>(
  samples: T[],
  window: Window,
): T[] {
  return samples.filter(
    (sample) => sample.timestamp >= window.from && sample.timestamp < window.to,
  );
}
