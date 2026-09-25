import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TimerScreen } from "@/components/TimerScreen";
import { BiometricsProvider } from "@/providers/biometrics-provider";
import { SettingsProvider } from "@/providers/settings-provider";

function renderTimer() {
  return render(
    <SettingsProvider>
      <BiometricsProvider>
        <TimerScreen />
      </BiometricsProvider>
    </SettingsProvider>,
  );
}

/** Lets the animation-frame loop run for `ms` of virtual time. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function click(testId: string) {
  act(() => {
    screen.getByTestId(testId).click();
  });
}

const dial = () => screen.getByTestId("dial-time").textContent;
const phase = () => screen.getByTestId("phase-label").textContent;

describe("TimerScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    localStorage.clear();
  });

  it("opens on the default 20/10 × 8 protocol, ready to start", () => {
    renderTimer();

    expect(phase()).toBe("Get ready");
    expect(dial()).toBe("10");
    expect(screen.getByTestId("round-readout").textContent).toBe("Round 1 / 8");
    expect(screen.getAllByTestId("round-pip")).toHaveLength(8);
    expect(screen.getByTestId("control-primary")).toHaveAccessibleName("Start");
  });

  it("runs prepare, work and rest in order", () => {
    renderTimer();
    click("control-primary");

    advance(1_100);
    expect(phase()).toBe("Get ready");
    expect(dial()).toBe("9");

    advance(8_900);
    expect(phase()).toBe("Work");
    expect(dial()).toBe("20");

    advance(20_000);
    expect(phase()).toBe("Rest");
    expect(dial()).toBe("10");
    expect(screen.getByTestId("round-readout").textContent).toBe("Round 1 / 8");

    advance(10_000);
    expect(phase()).toBe("Work");
    expect(screen.getByTestId("round-readout").textContent).toBe("Round 2 / 8");
  });

  it("pauses and resumes without losing position", () => {
    renderTimer();
    click("control-primary");
    advance(14_000);
    expect(dial()).toBe("16");

    click("control-primary");
    expect(screen.getByTestId("control-primary")).toHaveAccessibleName(
      "Resume",
    );
    advance(30_000);
    expect(dial()).toBe("16");

    click("control-primary");
    advance(1_100);
    expect(dial()).toBe("15");
  });

  it("skips between intervals and resets", () => {
    renderTimer();
    click("control-primary");
    advance(2_000);

    click("control-skip-forward");
    advance(100);
    expect(phase()).toBe("Work");

    // Well into the interval, back restarts it; near its start it steps to the previous one.
    advance(4_000);
    click("control-skip-back");
    advance(100);
    expect(phase()).toBe("Work");
    expect(dial()).toBe("20");

    click("control-skip-back");
    advance(100);
    expect(phase()).toBe("Get ready");

    click("control-reset");
    advance(100);
    expect(phase()).toBe("Get ready");
    expect(dial()).toBe("10");
    expect(screen.getByTestId("control-primary")).toHaveAccessibleName("Start");
  });

  it("completes the whole session", () => {
    renderTimer();
    click("control-primary");
    // 10s prepare + 8 × 20s work + 7 × 10s rest.
    advance((10 + 8 * 20 + 7 * 10) * 1000 + 500);

    expect(screen.getByTestId("summary-rounds").textContent).toBe("8 / 8");
    expect(screen.queryByTestId("dial-time")).toBeNull();
    // No strap in this test, so no fabricated physiology.
    expect(screen.queryByTestId("summary-metrics")).toBeNull();
    expect(screen.queryByTestId("round-chart")).toBeNull();

    click("summary-reset");
    advance(100);
    expect(phase()).toBe("Get ready");
    expect(screen.getByTestId("control-primary")).toHaveAccessibleName("Start");
  });

  it("shows the next phase and remaining session time", () => {
    renderTimer();
    click("control-primary");
    advance(1_000);

    expect(screen.getByTestId("session-readout").textContent).toMatch(
      /left · next work/,
    );
  });

  it("stays on the configured intervals and says nothing in classic mode", () => {
    renderTimer();
    expect(screen.getByTestId("mode-classic")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    click("control-primary");
    advance(30_100);
    expect(phase()).toBe("Rest");
    expect(dial()).toBe("10");
    expect(screen.queryByTestId("adaptive-decision")).toBeNull();
  });

  it("explains each transition in adaptive mode without moving the clock", () => {
    renderTimer();
    click("mode-adaptive");
    click("control-primary");

    advance(10_100);
    const first = screen.getByTestId("adaptive-decision");
    expect(within(first).getByTestId("decision-headline").textContent).toBe(
      "Standard interval",
    );
    expect(within(first).getByTestId("decision-lead").textContent).toBe(
      "next rest: 10 sec",
    );
    expect(dial()).toBe("20");

    // The verdict clears itself; the interval it announced is unchanged.
    advance(3_000);
    expect(screen.queryByTestId("adaptive-decision")).toBeNull();
    advance(17_000);
    expect(phase()).toBe("Rest");
    expect(dial()).toBe("10");

    // Rest → work with no strap: the honest verdict is that nothing was measured.
    advance(10_000);
    expect(phase()).toBe("Work");
    const second = screen.getByTestId("adaptive-decision");
    expect(within(second).getByTestId("decision-headline").textContent).toBe(
      "Insufficient sensor data · standard interval",
    );
    expect(screen.queryByTestId("decision-detail")).toBeNull();
  });

  it("logs every adaptive round on the summary", () => {
    renderTimer();
    click("mode-adaptive");
    click("control-primary");
    advance((10 + 8 * 20 + 7 * 10) * 1000 + 500);

    const rows = screen.getAllByTestId("adaptation-row");
    expect(rows).toHaveLength(8);
    expect(rows[0].textContent).toBe("Round 1standardno sensor data");
  });

  it("keeps biometric tiles in the layout with no sensor attached", () => {
    renderTimer();
    const strip = screen.getByTestId("biometrics-strip");

    expect(
      within(strip).getByTestId("metric-heart-rate").textContent,
    ).toContain("connect h10");
    expect(within(strip).getByTestId("metric-hrv").textContent).toContain("—");
    expect(screen.queryByTestId("dial-heart-rate-arc")).not.toBeInTheDocument();
  });
});
