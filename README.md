# Tabata

A dark, mobile-first Tabata PWA built around one very large central timer. Defaults to the classic
protocol: 20s work / 10s rest / 8 rounds.

## Features

- Configurable work, rest, rounds, sets, set rest, prepare and cooldown; persisted locally.
- Drift-free timer driven by wall-clock timestamps, not by accumulating ticks.
- Start/pause/resume, skip forward/back, reset; keyboard shortcuts (space, `R`, arrow keys).
- Audio cues, vibration and screen wake lock while a session runs.
- Installable PWA with an offline app shell.
- Live heart rate, RR intervals and RMSSD HRV from any standard BLE chest strap (validated against a Polar H10) over Web Bluetooth.
- Heart-rate recovery during rest: the drop since the work → rest transition, measured, never estimated.
- The timer is fully usable with no sensor; Bluetooth is an optional enhancement.

## Biometrics architecture

Live physiology is modelled as a vendor-neutral stream so a real strap can be added without touching the UI:

- `src/lib/biometrics/types.ts` — `BiometricsSource` contract (capabilities, connect/disconnect, event subscription).
- `src/lib/biometrics/store.ts` — framework-agnostic store folding source events into an immutable snapshot.
- `src/lib/biometrics/hrv.ts` — RR-interval cleaning, RMSSD and SDNN.
- `src/lib/biometrics/heart-rate-measurement.ts` — flag-driven parser for the 0x2A37 characteristic (8/16-bit HR, energy expended, RR intervals in 1/1024 s).
- `src/lib/biometrics/rr-window.ts` — bounded rolling RR window (60 s / 240 beats) with plausibility filtering; HRV is withheld below 20 valid intervals.
- `src/lib/biometrics/web-bluetooth-source.ts` — Web Bluetooth source: device chooser, GATT, notifications, battery, reconnect with backoff.
- `src/lib/biometrics/registry.ts` — catalogue of sources (demo, BLE strap, planned watch relay).
- `src/providers/biometrics-provider.tsx` — React binding via `useSyncExternalStore`.
- `src/lib/session/recorder.ts` — records phase markers alongside HR/HRV samples for later analysis.

Adding another source means implementing `BiometricsSource` and registering it; the HR/HRV tiles, the
heart-rate arc around the dial and the session log already consume it.

Bluetooth state and timer state never touch: the source emits events into the store, the timer runs off
wall-clock timestamps, and neither can reset or delay the other.

### Connecting a strap

Web Bluetooth needs a secure context (HTTPS or localhost) and a Chromium-based browser. Open **Sensors**,
tap **Connect H10** and pick the strap in the browser's device chooser — the app never stores device
identifiers. HRV shows `collecting…` until 20 valid RR intervals have arrived, then reports RMSSD in ms.
The Sensors screen has a collapsed **Diagnostics** panel with device name, status, latest bpm, RR counts
and HRV readiness for field testing.

HRV here is RMSSD over the rolling RR window. It is not a stress, readiness or recovery score and carries
no medical meaning.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit + component (vitest)
npm run test:e2e   # Playwright smoke tests against a production build
npm run lint
npm run typecheck
npm run build
npm run icons      # regenerate PWA icons (requires Pillow)
```

## Deployment

Deployed on Vercel as a static-first Next.js app; no server state and no environment variables are required.
