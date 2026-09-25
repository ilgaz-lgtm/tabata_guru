
# Tabata.guru

**A physiology-aware Tabata trainer built from scratch with Devin at Fish Tank by Cognition × Hub71.**

🌐 **Live:** https://tabataguru.vercel.app

Tabata.guru combines a classic interval-training timer with live physiological data from a Bluetooth heart-rate sensor.

A normal Tabata timer knows **what the workout asked you to do**.

Tabata.guru also knows **how your body actually responded**.

Using a Polar H10, the app receives live heart rate and RR intervals directly in the browser, calculates RMSSD HRV, measures heart-rate recovery between intervals, and keeps the workout usable even when no sensor is connected.

---

## Built during Fish Tank

This project started from a fresh repository during the four-hour **Fish Tank by Devin & Hub71** build session.

Devin was used as the primary software-engineering agent to:

- scaffold the application
- design the timer architecture
- implement and test the Tabata state machine
- create the mobile-first PWA
- integrate Web Bluetooth
- implement the Bluetooth Heart Rate Service
- parse real Polar H10 heart-rate and RR packets
- calculate live RMSSD HRV
- add heart-rate recovery tracking
- diagnose real hardware connection failures discovered during physical testing
- implement automatic BLE reconnection and regression tests
- create pull requests
- run lint, typecheck, unit and Playwright tests
- deploy and debug the production application on Vercel

The Polar H10 integration was physically tested during the event using live biometric data — not simulated sensor readings.

---

## The idea

Classic Tabata is simple:

**20 seconds work → 10 seconds rest → repeat**

But everybody receives the same timer regardless of what is happening physiologically.

Tabata.guru separates two things:

```text
Workout protocol
        +
Actual human response
```

The timer controls the prescribed workout.

The sensor observes the person performing it.

This creates the foundation for interval training that can eventually adapt to the individual rather than treating every athlete and every round identically.

---

## Live physiology

With a compatible Bluetooth heart-rate strap such as the **Polar H10**, Tabata.guru can display:

- ❤️ Live heart rate
- 🫀 RR intervals
- 📈 RMSSD HRV
- ↓ Heart-rate recovery during rest
- 🔋 Sensor battery
- 🔄 Automatic reconnect after connection loss

Sensor data is read directly by the browser through Web Bluetooth.

No Polar cloud account, backend server or database is required.

The sensor is optional — Tabata.guru remains a complete standalone Tabata timer without it.

---

## Demo

### Without a sensor

Open:

https://tabataguru.vercel.app

Configure a workout and start training.

Default protocol:

```text
Prepare: 10 sec
Work:    20 sec
Rest:    10 sec
Rounds:  8
```

### With a Polar H10

1. Wear the H10 and ensure the sensor is awake.
2. Open Tabata.guru in a Chromium-based browser.
3. Open **Sensors**.
4. Select **Connect H10**.
5. Choose the Polar H10 in the browser's Bluetooth chooser.
6. Live BPM appears immediately.
7. RR intervals accumulate and HRV becomes available once enough valid data has been collected.
8. Start the workout and watch physiological response change across work and recovery periods.

---

## Why it is different

### Innovation

The workout protocol and the physiological response are treated as separate streams.

That means Tabata.guru can understand not only:

> “10 seconds of rest have passed.”

but also:

> “What happened to the athlete during those 10 seconds?”

This opens the door to adaptive work/rest intervals driven by actual recovery rather than a fixed timer alone.

### Practicality

The core product works without:

- an account
- a database
- a backend
- an AI service
- a wearable

Adding a compatible BLE sensor simply upgrades the experience.

### Real hardware

The application has been physically validated with a **Polar H10**, including:

- live BPM
- RR intervals
- HRV
- battery level
- connection loss
- reconnection after walking out of Bluetooth range

### Devin use case

This was not a pre-built application polished during the event.

The repository began as a fresh hackathon project.

Devin took the product from:

**specification → implementation → tests → pull requests → production deployment**

It then iterated against problems discovered through real-world hardware testing during the event.

---

## Features

- Configurable work, rest, rounds, sets, set rest, prepare and cooldown
- Settings persisted locally
- Drift-resistant timer based on wall-clock timestamps
- Start / pause / resume / skip / reset
- Keyboard shortcuts
- Audio cues
- Vibration support
- Screen wake lock
- Installable PWA
- Offline application shell
- Live BLE heart rate
- RR interval capture
- RMSSD HRV
- Heart-rate recovery tracking
- Polar H10 battery status
- Bluetooth reconnect with backoff
- Diagnostic tools for field testing
- Fully functional without a sensor

---

## Biometrics architecture

Biometrics are implemented as a vendor-neutral stream rather than being coupled directly to Polar.

```text
Bluetooth sensor
      ↓
BiometricsSource
      ↓
Biometrics Store
      ↓
HR / RR / HRV
      ↓
Session Recorder
      ↓
Tabata UI
```

This allows another sensor source to be added without rewriting the workout UI.

### Key modules

- `src/lib/biometrics/types.ts`
  - `BiometricsSource` contract and capabilities

- `src/lib/biometrics/store.ts`
  - framework-independent biometric state store

- `src/lib/biometrics/heart-rate-measurement.ts`
  - parser for Bluetooth characteristic `0x2A37`
  - supports 8-bit and 16-bit HR
  - energy-expended flag
  - multiple RR intervals per notification
  - RR values converted from 1/1024 second units

- `src/lib/biometrics/hrv.ts`
  - RR cleaning
  - RMSSD
  - SDNN

- `src/lib/biometrics/rr-window.ts`
  - bounded rolling RR window
  - plausibility filtering
  - HRV withheld until sufficient data exists

- `src/lib/biometrics/web-bluetooth-source.ts`
  - Web Bluetooth device chooser
  - GATT connection
  - Heart Rate Service
  - notifications
  - battery
  - disconnect handling
  - reconnect with backoff

- `src/lib/biometrics/registry.ts`
  - available biometric sources

- `src/providers/biometrics-provider.tsx`
  - React binding via `useSyncExternalStore`

- `src/lib/session/recorder.ts`
  - records physiological samples alongside workout phases

Bluetooth and timer state are deliberately isolated.

A sensor disconnect cannot reset or delay the workout timer.

---

## HRV

HRV is currently reported as **RMSSD** calculated from valid RR intervals over a bounded rolling window.

It is deliberately presented as a physiological measurement — not as a medical diagnosis, stress score or readiness score.

If insufficient RR data is available, the app displays:

`collecting…`

rather than estimating a value.

---

## Development

```bash
npm install
npm run dev
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

---

## Deployment

Tabata.guru is deployed on Vercel as a static-first Next.js application.

No server state or environment variables are required.

**Production:** https://tabataguru.vercel.app
