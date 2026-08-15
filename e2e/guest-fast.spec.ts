import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const LOCAL_STORAGE_KEY = "fasttrack.local-dashboard.v1";

test("guest dashboard has no serious or critical automated accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  const seriousViolations = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );

  expect(seriousViolations).toEqual([]);
});

test("mobile start action is visible and the page has an accessible heading", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeAttached();
  const startButton = page.getByRole("button", { name: "Start fast" });
  await expect(startButton).toBeVisible();

  const bounds = await startButton.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);

  if (process.env.FASTTRACK_AUDIT_CAPTURE_DIR) {
    await page.screenshot({
      path: `${process.env.FASTTRACK_AUDIT_CAPTURE_DIR}/12-dashboard-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
});

test("a guest can record that a forgotten timer ended at the planned 16-hour mark", async ({ page }, testInfo) => {
  const now = Date.now();
  const startedAt = new Date(now - 20 * 60 * 60 * 1000).toISOString();

  await page.addInitScript(
    ({ storageKey, startedAtValue, createdAt }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          activeSession: {
            id: "local-forgotten-fast",
            userId: "local",
            startedAt: startedAtValue,
            endedAt: null,
            durationMinutes: null,
            plannedMinutes: 16 * 60,
            status: "active",
            notes: null,
            createdAt,
            stageReached: 0,
          },
          sessions: [],
          milestoneStageReached: 0,
        })
      );
    },
    { storageKey: LOCAL_STORAGE_KEY, startedAtValue: startedAt, createdAt: new Date(now).toISOString() }
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Keep going" }).click();
  await page.getByRole("button", { name: "End fast" }).click();
  await page.getByRole("button", { name: "Ended earlier" }).click();
  await page.getByRole("button", { name: "At planned end" }).click();
  await expect(page.getByText("16h", { exact: false }).first()).toBeVisible();

  if (process.env.FASTTRACK_AUDIT_CAPTURE_DIR) {
    await page.screenshot({
      path: `${process.env.FASTTRACK_AUDIT_CAPTURE_DIR}/13-ended-earlier-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }

  await page.getByRole("button", { name: "Save completed fast" }).click();

  await expect(page.getByRole("dialog").getByText("Fast Complete")).toBeVisible();
  const stored = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), LOCAL_STORAGE_KEY);
  expect(stored).toContain('"durationMinutes":960');
});

test("a guest can set an exact earlier end time without the native clock picker", async ({ page }) => {
  const now = Date.now();
  const startedAt = new Date(now - 5 * 60 * 60 * 1000).toISOString();

  await page.addInitScript(
    ({ storageKey, startedAtValue, createdAt }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          activeSession: {
            id: "local-custom-end-time",
            userId: "local",
            startedAt: startedAtValue,
            endedAt: null,
            durationMinutes: null,
            plannedMinutes: 16 * 60,
            status: "active",
            notes: null,
            createdAt,
            stageReached: 0,
          },
          sessions: [],
          milestoneStageReached: 0,
        })
      );
    },
    { storageKey: LOCAL_STORAGE_KEY, startedAtValue: startedAt, createdAt: new Date(now).toISOString() }
  );

  await page.goto("/");
  await page.getByRole("button", { name: "End fast" }).click();
  await page.getByRole("button", { name: "Ended earlier" }).click();

  const target = await page.evaluate(() => {
    const date = new Date(Date.now() - 30 * 60 * 1000);
    const localDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const hour = date.getHours() % 12 || 12;

    return {
      date: localDate,
      hour: String(hour),
      minute: String(date.getMinutes()),
      period: date.getHours() >= 12 ? "PM" : "AM",
    };
  });

  await page.getByLabel("End date").fill(target.date);
  await page.getByLabel("End time hour").selectOption(target.hour);
  await page.getByLabel("End time minute").selectOption(target.minute);
  await page.getByLabel("End time AM or PM").selectOption(target.period);

  await expect(page.getByLabel("End time hour")).toHaveValue(target.hour);
  await expect(page.getByLabel("End time minute")).toHaveValue(target.minute);
  await expect(page.getByLabel("End time AM or PM")).toHaveValue(target.period);
  await expect(page.getByText("Choose a valid", { exact: false })).toHaveCount(0);

  await page.getByRole("button", { name: "Save completed fast" }).click();
  await expect(page.getByRole("dialog").getByText("Fast Complete")).toBeVisible();
});
