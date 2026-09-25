"use client";

import { useEffect, useRef } from "react";

/** Keeps the screen on while a workout is running, reacquiring after tab switches. */
export function useWakeLock(active: boolean): void {
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let cancelled = false;

    const request = async () => {
      if (!active || cancelled || sentinel.current) return;
      try {
        sentinel.current = await navigator.wakeLock.request("screen");
        sentinel.current.addEventListener("release", () => {
          sentinel.current = null;
        });
      } catch {
        // Denied wake locks are non-fatal.
      }
    };

    const release = () => {
      void sentinel.current?.release();
      sentinel.current = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void request();
    };

    if (active) {
      void request();
      document.addEventListener("visibilitychange", onVisibilityChange);
    } else {
      release();
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [active]);
}
