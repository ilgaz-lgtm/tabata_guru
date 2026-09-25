# Tabata

A dark, mobile-first Tabata PWA built around one very large central timer. Defaults to the classic
protocol: 20s work / 10s rest / 8 rounds.

## Features

- Configurable work, rest, rounds, sets, set rest, prepare and cooldown; persisted locally.
- Drift-free timer driven by wall-clock timestamps, not by accumulating ticks.
- Start/pause/resume, skip forward/back, reset; keyboard shortcuts (space, `R`, arrow keys).
- Audio cues, vibration and screen wake lock while a session runs.
- Installable PWA with an offline app shell.
- Heart rate and HRV are first-class in the layout and in the data model, ahead of any vendor integration.

## Biometrics architecture

Live physiology is modelled as a vendor-neutral stream so a real strap can be added without touching the UI:

- `src/lib/biometrics/types.ts` — `BiometricsSource` contract (capabilities, connect/disconnect, event subscription).
- `src/lib/biometrics/store.ts` — framework-agnostic store folding source events into an immutable snapshot.
- `src/lib/biometrics/hrv.ts` — RR-interval cleaning, RMSSD and SDNN.
- `src/lib/biometrics/registry.ts` — catalogue of sources; only the simulated one is implemented today.
- `src/providers/biometrics-provider.tsx` — React binding via `useSyncExternalStore`.
- `src/lib/session/recorder.ts` — records phase markers alongside HR/HRV samples for later analysis.

Adding a Bluetooth or watch-relay source means implementing `BiometricsSource` and registering it; the
HR/HRV tiles, the heart-rate arc around the dial and the session log already consume it.

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
