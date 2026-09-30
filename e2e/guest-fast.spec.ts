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

test("earlier-start date and clock stay reachable above a visible mobile footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start fast", exact: true }).click();
  await page.getByRole("button", { name: "I understand", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Started earlier", exact: true }).click();
  await page.getByLabel("Start date", { exact: true }).fill("2026-02-30");
  await dialog.getByRole("button", { name: "Start fast", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("valid date");
  await dialog.getByRole("button", { name: "30m ago", exact: true }).click();
  await page.getByLabel("Start time minute", { exact: true }).scrollIntoViewIfNeeded();
  const clock = await page.getByLabel("Start time minute", { exact: true }).boundingBox();
  const footer = await dialog.locator('[data-slot="dialog-footer"]').boundingBox();
  const viewport = page.viewportSize()!;
  expect(clock).not.toBeNull();
  expect(footer).not.toBeNull();
  expect(clock!.y + clock!.height).toBeLessThanOrEqual(footer!.y);
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(viewport.height);
  await dialog.getByRole("button", { name: "Start fast", exact: true }).click();
  await expect(page.getByRole("button", { name: "End fast", exact: true })).toBeVisible();
});

test("blocked device storage leaves timer usable with an honest warning", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Device storage is unavailable");
  await page.getByRole("button", { name: "Start fast", exact: true }).click();
  await page.getByRole("button", { name: "I understand", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start fast", exact: true }).click();
  await expect(page.getByRole("button", { name: "End fast", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("malformed local session cannot crash dashboard rendering", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ activeSession: { id: "broken", startedAt: "bad" }, sessions: [null, "bad"] })), LOCAL_STORAGE_KEY);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start fast", exact: true })).toBeVisible();
});

test("plan controls stay compact and return keyboard focus after a choice", async ({ page }) => {
  await page.goto("/");
  const plan = page.locator("details").filter({ has: page.locator("legend", { hasText: "Choose a fasting window" }) });
  await expect(plan).not.toHaveAttribute("open");
  await expect(page.getByRole("button", { name: "12h", exact: true })).toBeHidden();
  await plan.locator("summary").click();
  await page.getByRole("button", { name: "14h", exact: true }).click();
  await expect(plan.locator("summary")).toContainText("14h plan");
  await expect(plan).not.toHaveAttribute("open");
  await expect(plan.locator("summary")).toBeFocused();
  await expect(page.getByRole("timer")).toContainText("14h planned window");
});

test("week strip labels real completions without counting an active fast", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    const now = new Date();
    const endedAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0).toISOString();
    const startedAt = new Date(Date.parse(endedAt) - 16 * 60 * 60 * 1000).toISOString();
    const session = {
      id: "completed-recent-fast", userId: "local", startedAt, endedAt,
      durationMinutes: 960, plannedMinutes: 960, status: "completed",
      notes: null, createdAt: startedAt, stageReached: 0,
    };
    window.localStorage.setItem(storageKey, JSON.stringify({
      activeSession: { ...session, id: "current-fast", status: "active", startedAt: new Date().toISOString(), endedAt: null, durationMinutes: null },
      sessions: [session], milestoneStageReached: 0,
    }));
  }, LOCAL_STORAGE_KEY);
  await page.goto("/");
  const week = page.getByRole("region", { name: "Recent completions in the last seven days" });
  await expect(week.getByRole("listitem")).toHaveCount(7);
  await expect(week.getByRole("listitem", { name: /today: 1 completed fast in recent history/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Edit start time/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "End fast", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel fast", exact: true })).toBeHidden();
  await page.locator("summary", { hasText: "Session details" }).click();
  await expect(page.getByRole("button", { name: "Cancel fast", exact: true })).toBeVisible();
});
