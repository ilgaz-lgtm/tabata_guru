"use client";

import { useEffect } from "react";

import { SimulatedBiometricsSource } from "@/lib/biometrics/simulated-source";
import { useBiometrics } from "@/providers/biometrics-provider";
import { useSettings } from "@/providers/settings-provider";

/**
 * Keeps the demo source attached wherever the app is, so the sensors screen and
 * the timer share one lifecycle instead of only connecting on the timer route.
 */
export function DemoSensorBridge() {
  const { settings } = useSettings();
  const { snapshot, attach, detach } = useBiometrics();

  useEffect(() => {
    if (!settings.demoBiometrics) {
      if (snapshot.sourceId === "simulated") void detach();
      return;
    }
    if (snapshot.sourceId !== "simulated") void attach(new SimulatedBiometricsSource());
  }, [settings.demoBiometrics, snapshot.sourceId, attach, detach]);

  return null;
}
