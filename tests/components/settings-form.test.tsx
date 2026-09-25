import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsForm } from "@/components/SettingsForm";
import { loadSettings } from "@/lib/settings/storage";
import { SettingsProvider } from "@/providers/settings-provider";

function renderForm() {
  return render(
    <SettingsProvider>
      <SettingsForm />
    </SettingsProvider>,
  );
}

function click(element: HTMLElement) {
  act(() => {
    element.click();
  });
}

describe("SettingsForm", () => {
  it("summarises the protocol and marks the classic default", () => {
    renderForm();
    expect(screen.getByTestId("settings-total").textContent).toBe(
      "8 × 20s work / 10s rest · 4m total · classic Tabata",
    );
  });

  it("persists stepper changes and updates the summary", () => {
    renderForm();
    click(screen.getByLabelText("Increase Work"));
    click(screen.getByLabelText("Decrease Rounds"));

    expect(screen.getByTestId("settings-total").textContent).toContain("7 × 25s work / 10s rest");
    expect(loadSettings()).toMatchObject({ workSeconds: 25, rounds: 7 });
  });

  it("clamps at field bounds", () => {
    renderForm();
    const decreaseRounds = screen.getByLabelText("Decrease Rounds");
    for (let i = 0; i < 12; i += 1) click(decreaseRounds);

    expect(loadSettings().rounds).toBe(1);
    expect(decreaseRounds).toBeDisabled();
  });

  it("toggles feedback and demo biometrics", () => {
    renderForm();
    click(screen.getByTestId("setting-sound"));
    click(screen.getByTestId("setting-demo-biometrics"));

    expect(loadSettings()).toMatchObject({ soundEnabled: false, demoBiometrics: true });
    expect(screen.getByTestId("setting-demo-biometrics")).toHaveAttribute("aria-checked", "true");
  });

  it("restores defaults", () => {
    renderForm();
    click(screen.getByLabelText("Increase Rounds"));
    click(screen.getByTestId("settings-reset"));

    expect(loadSettings().rounds).toBe(8);
    expect(screen.getByTestId("settings-total").textContent).toContain("classic Tabata");
  });
});
