"use client";

import { useEffect, useRef } from "react";

import { SimulatedBiometricsSource } from "@/lib/biometrics/simulated-source";
import { useBiometrics } from "@/providers/biometrics-provider";
import { useSettings } from "@/providers/settings-provider";

/**
 * Keeps the demo source attached wherever the app is, so the sensors screen and
 * the timer share one lifecycle instead of only connecting on the timer route.
 *
 * It owns only the source it attached itself: a real strap always wins the
 * single source slot, and a stale `demoBiometrics` preference can never evict
 * it or resurrect the demo behind it.
 */
export function DemoSensorBridge() {
  const { settings } = useSettings();
  const { snapshot, attach, detachSource } = useBiometrics();
  const owned = useRef<SimulatedBiometricsSource | null>(null);

  useEffect(() => {
    if (!settings.demoBiometrics) {
      const source = owned.current;
      owned.current = null;
      if (source) void detachSource(source);
      return;
    }

    if (snapshot.sourceId !== null) return;

    const source = new SimulatedBiometricsSource();
    owned.current = source;
    void attach(source);
  }, [settings.demoBiometrics, snapshot.sourceId, attach, detachSource]);

  return null;
}
