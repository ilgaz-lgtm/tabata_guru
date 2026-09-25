/** Seconds remaining, rounded up so a 20s interval reads "20" on its first frame. */
export function remainingSeconds(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/** `m:ss` for anything under an hour, `h:mm:ss` beyond. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/** Big-dial rendering: bare seconds under a minute, `m:ss` above. */
export function formatDial(remainingMs: number): string {
  const seconds = remainingSeconds(remainingMs);
  return seconds < 60 ? String(seconds) : formatClock(seconds);
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
