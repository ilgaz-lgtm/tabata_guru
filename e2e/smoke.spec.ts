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
  await expect(page.getByTestId("phase-label")).toHaveText("Complete", { timeout: 20_000 });
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
