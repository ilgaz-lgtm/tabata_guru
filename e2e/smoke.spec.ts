import { expect, test } from "@playwright/test";

async function setField(page: import("@playwright/test").Page, key: string, value: number) {
  const input = page.getByTestId(`setting-${key}-input`);
  await input.fill(String(value));
  await input.blur();
}

test("runs a shortened session end to end", async ({ page }) => {
  await page.goto("/settings");

  await setField(page, "prepareSeconds", 0);
  await setField(page, "workSeconds", 3);
  await setField(page, "restSeconds", 1);
  await setField(page, "rounds", 2);

  await page.getByTestId("back-to-timer").click();

  await expect(page.getByTestId("dial-time")).toHaveText("3");
  await expect(page.getByTestId("round-readout")).toHaveText("Round 1 / 2");

  await page.getByTestId("control-primary").click();
  await expect(page.getByTestId("phase-label")).toHaveText("Work");
  await expect(page.getByTestId("session-summary")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("summary-rounds")).toHaveText("2 / 2");

  await page.getByTestId("summary-reset").click();
  await expect(page.getByTestId("dial-time")).toHaveText("3");
});

test("keeps the timer legible and centred on a phone viewport", async ({ page }) => {
  await page.goto("/");

  const dial = page.getByTestId("dial-time");
  await expect(dial).toBeVisible();

  const box = await dial.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  // The clock is the focal point: comfortably wide and horizontally centred.
  const centre = box!.x + box!.width / 2;
  expect(Math.abs(centre - viewport!.width / 2)).toBeLessThan(24);
  expect(box!.height).toBeGreaterThan(viewport!.height * 0.08);

  await expect(page.getByTestId("metric-heart-rate")).toBeVisible();
  await expect(page.getByTestId("metric-hrv")).toBeVisible();
});

test("fits the controls above the fold on a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");

  const controls = page.getByTestId("control-primary");
  const box = await controls.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(568);
  expect(box!.width).toBeGreaterThanOrEqual(56);

  for (const id of ["control-skip-back", "control-skip-forward", "control-reset"]) {
    const secondary = await page.getByTestId(id).boundingBox();
    expect(secondary!.width).toBeGreaterThanOrEqual(40);
  }
});

test("connects the demo sensor from the sensors screen", async ({ page }) => {
  await page.goto("/sensors");

  const toggle = page.getByTestId("sensor-simulated");
  await expect(toggle).toHaveText("Connect");

  await toggle.click();
  await expect(toggle).toHaveText("Disconnect");
  await expect(page.getByTestId("sensor-live-readout")).toContainText("connected");

  await toggle.click();
  await expect(toggle).toHaveText("Connect");
});

test("offers the strap only when the browser supports web bluetooth", async ({ page }) => {
  await page.goto("/sensors");

  const strap = page.getByTestId("sensor-ble-heart-rate");
  const supported = await page.evaluate(() => "bluetooth" in navigator);

  if (supported) {
    await expect(strap).toHaveText("Connect H10");
    await expect(strap).toBeEnabled();
  } else {
    await expect(strap).toBeDisabled();
    await expect(page.getByTestId("sensor-ble-heart-rate-unsupported")).toContainText("Web Bluetooth");
  }

  await expect(page.getByTestId("sensor-diagnostics")).toBeVisible();
});

test("shows the connect prompt on the timer instead of a fake reading", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("metric-heart-rate")).toContainText("connect h10");
  await expect(page.getByTestId("metric-heart-rate")).toContainText("—");
});
