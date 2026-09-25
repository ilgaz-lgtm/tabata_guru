"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { SimulatedBiometricsSource } from "@/lib/biometrics/simulated-source";
import { BiometricsStore } from "@/lib/biometrics/store";
import { EMPTY_SNAPSHOT, type BiometricsSnapshot, type BiometricsSource } from "@/lib/biometrics/types";

interface BiometricsContextValue {
  snapshot: BiometricsSnapshot;
  /** Attaches a source and starts streaming; replaces any current source. */
  attach: (source: BiometricsSource) => Promise<void>;
  detach: () => Promise<void>;
  /** Detaches `source` only if it is still the attached one. */
  detachSource: (source: BiometricsSource) => Promise<void>;
  /**
   * Current workout intensity (0..1). Real sensors ignore it; the demo source
   * uses it to produce a believable heart-rate response.
   */
  reportIntensity: (intensity: number) => void;
}

const BiometricsContext = createContext<BiometricsContextValue | null>(null);

export function BiometricsProvider({
  children,
  store: injectedStore,
}: {
  children: ReactNode;
  store?: BiometricsStore;
}) {
  const storeRef = useRef<BiometricsStore | null>(injectedStore ?? null);
  storeRef.current ??= new BiometricsStore();
  const store = storeRef.current;

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_SNAPSHOT);

  useEffect(() => () => void store.detach(), [store]);

  const attach = useCallback((source: BiometricsSource) => store.attach(source), [store]);
  const detach = useCallback(() => store.detach(), [store]);
  const detachSource = useCallback((source: BiometricsSource) => store.detachSource(source), [store]);

  const reportIntensity = useCallback(
    (intensity: number) => {
      const source = store.getSource();
      if (source instanceof SimulatedBiometricsSource) source.setIntensity(intensity);
    },
    [store],
  );

  const value = useMemo(
    () => ({ snapshot, attach, detach, detachSource, reportIntensity }),
    [snapshot, attach, detach, detachSource, reportIntensity],
  );

  return <BiometricsContext.Provider value={value}>{children}</BiometricsContext.Provider>;
}

export function useBiometrics(): BiometricsContextValue {
  const value = useContext(BiometricsContext);
  if (!value) throw new Error("useBiometrics must be used inside a BiometricsProvider");
  return value;
}
