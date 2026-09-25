import "@testing-library/jest-dom/vitest";

import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

// jsdom implements neither of these, and both are optional enhancements.
Object.defineProperty(navigator, "vibrate", { value: vi.fn(), writable: true, configurable: true });
if (!("requestAnimationFrame" in globalThis)) {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 16) as unknown as number) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((handle: number) => clearTimeout(handle)) as typeof cancelAnimationFrame;
}
