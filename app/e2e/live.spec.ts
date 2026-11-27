import { writeFileSync } from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { serverQuery } from "./live-server";

// The real back end, end to end: PowerSync sync, the Supabase rule functions,
// PIN sign-in on a demo tablet, office sign-in. Run with `npm run e2e:live`
// (ARRIS_LIVE=1). It resets the practice project's demo before and after
// (live-setup.ts), records video, and runs once, on the tablet project, in
// order, because every step changes shared server state.
//
// Steps follow the Stage 2c brief: Tom on a demo tablet passes J-1042's bench
// stage and undoes it; a change made offline syncs when the signal returns;
// two people moving the same job at once get the conflict screen; Tom raises
// a drawing query and Steve sees it on Today. Resolving it needs an uploaded
// drawing, and uploads arrive in Stage 3, so the run stops at "sees the query".

test.describe.configure({ mode: "serial" });
test.skip(({ browserName }) => browserName !== "chromium");

test.beforeAll(() => {
  test.skip(test.info().project.name !== "tablet", "The live run changes shared server state, so it runs once.");
});

const SYNC = { timeout: 30_000 };
const STEVE = "ab78906c-6f08-efb8-75e5-4e7018f4d731";

/** Every console error and page error in the run, saved for the report. */
const consoleProblems: string[] = [];
function watchConsole(context: BrowserContext, who: string) {
  context.on("page", (page) => {
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") consoleProblems.push(`${who} ${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => consoleProblems.push(`${who} pageerror: ${e.message}`));
  });
}
test.afterAll(() => {
  writeFileSync("test-results/live-console.txt", consoleProblems.join("\n") + "\n");
});

async function tomOnTheBenchTablet(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, locale: "en-GB", timezoneId: "Europe/London", recordVideo: { dir: "test-results/live-video/1-tom-bench-tablet" } });
  watchConsole(context, "tom");
  const page = await context.newPage();
  await page.goto("/signin?source=live");
  await expect(page.getByText("This device isn't a workshop tablet")).toBeVisible(SYNC);
  await page.getByRole("button", { name: "Use the demo bench tablet" }).click();
  await page.getByRole("button", { name: "Tom Ashworth" }).click(SYNC);
  for (const d of "4826") await page.getByRole("button", { name: d, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Next for you" })).toBeVisible(SYNC);
  return page;
}

async function steveAtTheOffice(browser: Browser, page?: Page, video = "steve-office"): Promise<Page> {
  if (!page) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-GB", timezoneId: "Europe/London", recordVideo: { dir: `test-results/live-video/${video}` } });
    watchConsole(context, "steve");
    page = await context.newPage();
  }
  await page.goto("/signin/office?source=live");
  await page.getByLabel("Email").fill("steve.marsden@arris.demo");
  await page.getByLabel("Password").fill("arris-workshop");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "Board" })).toBeVisible(SYNC);
  return page;
}

let tom: Page;

test("Tom signs in on a demo tablet with his PIN, passes J-1042's bench stage and undoes it", async ({ browser }) => {
  tom = await tomOnTheBenchTablet(browser);
  await expect(tom.getByRole("article", { name: /J-1042/ })).toBeVisible(SYNC);
  await tom.getByRole("button", { name: "Bench work done" }).click();
  const passed = tom.getByRole("status").filter({ hasText: "J-1042 passed to Spray Booth" });
  await expect(passed).toBeVisible(SYNC);
  await passed.getByRole("button", { name: "Undo" }).click();
  await expect(tom.getByRole("article", { name: /J-1042/ })).toBeVisible(SYNC);
});

test("a change made with the network off is kept, then syncs when it comes back", async () => {
  const context = tom.context();
  const stage = () => serverQuery<{ stage: string }>("select stage from jobs where id = 'J-1042'")[0]?.stage;
  expect(stage()).toBe("bench");

  await context.setOffline(true);
  await tom.getByRole("button", { name: "Bench work done" }).click();
  await expect(tom.getByRole("status").filter({ hasText: "J-1042 passed to Spray Booth. Will send when back online" })).toBeVisible(SYNC);
  await expect(tom.getByText("Offline, 1 to send")).toBeVisible(SYNC);
  expect(stage()).toBe("bench");

  await context.setOffline(false);
  await expect(tom.getByText(/to send|Sending/)).toBeHidden(SYNC);
  await expect.poll(stage, SYNC).toBe("spray");
  // And back from the server: the job's own page shows Spray Booth with nothing waiting.
  await tom.goto("/job/J-1042");
  await expect(tom.getByRole("group", { name: /^Stage: Spray Booth/ })).toBeVisible(SYNC);
});

test("two people moving the same job at the same moment get the conflict screen", async ({ browser }) => {
  const a = await steveAtTheOffice(browser, undefined, "2-conflict-steve-a");
  const b = await steveAtTheOffice(browser, undefined, "2-conflict-steve-b");
  for (const p of [a, b]) {
    await p.goto("/job/J-1043");
    await expect(p.getByRole("button", { name: /Spray/ }).first()).toBeVisible(SYNC);
  }
  const primary = (p: Page) => p.locator(".actions").getByRole("button").first();
  await Promise.all([primary(a).click(), primary(b).click()]);
  const conflict = (p: Page) => p.getByRole("dialog", { name: /changed this job/ });
  await expect.poll(async () => (await conflict(a).isVisible()) || (await conflict(b).isVisible()), SYNC).toBe(true);
  await a.context().close();
  await b.context().close();
});

test("Tom raises a drawing query on J-1042, and Steve sees it on Today", async ({ browser }) => {
  await tom.goto("/job/J-1042");
  await tom.getByRole("button", { name: "Raise a drawing query" }).click();
  await tom.getByLabel("What's wrong, or unclear?").fill("Back panel height doesn't match the site survey.");
  await tom.getByRole("button", { name: "Send to Drawing Review" }).click();
  await expect(tom.getByRole("status").filter({ hasText: "J-1042 sent to Drawing Review" })).toBeVisible(SYNC);

  const steve = await steveAtTheOffice(browser, undefined, "3-steve-sees-query");
  await steve.goto("/today");
  await expect(steve.getByText(/Back panel height doesn't match the site survey/)).toBeVisible(SYNC);
  await steve.context().close();
  await tom.context().close();
});

test("a removed tablet loses its local copy once it's connected", async ({ browser }) => {
  const name = `Revocation test tablet ${Date.now() % 100000}`;
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, locale: "en-GB", timezoneId: "Europe/London", recordVideo: { dir: "test-results/live-video/4-revoked-tablet" } });
  watchConsole(context, "revoked-tablet");
  await context.addInitScript({ content: `try { window.localStorage.setItem("arris.diagnostics", "1"); } catch {}` });
  const page = await context.newPage();

  // Steve sets this browser up as a new tablet from the office, then hands it to the floor.
  await steveAtTheOffice(browser, page);
  await page.goto("/settings");
  const card = page.getByRole("region", { name: "This device" });
  await card.getByLabel("Tablet name").fill(name);
  await card.getByRole("button", { name: "Set up as a tablet" }).click();
  await expect(card.getByText(`This device is the ${name.toLowerCase()}`)).toBeVisible(SYNC);
  await page.getByRole("button", { name: /^Steve Marsden/ }).click();
  await page.goto("/signin");
  await page.getByRole("button", { name: "Tom Ashworth" }).click(SYNC);
  for (const d of "4826") await page.getByRole("button", { name: d, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Next for you" })).toBeVisible(SYNC);

  type Event = { at: number; event: string; rows?: number };
  const events = () => page.evaluate<Event[]>("window.arrisDiagnostics");
  await expect.poll(async () => (await events()).at(-1)?.rows ?? 0, SYNC).toBeGreaterThan(100);

  // Steve removes it, through the real revoke_device function, as his office session would.
  const id = serverQuery<{ id: string }>(`select id from devices where name = '${name}' and active`)[0]?.id;
  expect(id).toBeTruthy();
  const revokedAt = Date.now();
  const claims = JSON.stringify({ sub: STEVE, role: "authenticated", amr: [{ method: "password", timestamp: 1 }] });
  const answer = serverQuery<{ r: { kind: string } }>(`begin; select set_config('request.jwt.claims', '${claims}', true); select public.revoke_device('${id}') as r; commit;`);
  expect(answer[0]?.r.kind).toBe("ok");

  // The tablet is still connected. Its rows go, and it says why.
  await expect(page.getByText(`The ${name.toLowerCase()} was removed`)).toBeVisible(SYNC);
  await expect.poll(async () => (await events()).some((e) => e.event === "wipe"), SYNC).toBe(true);
  const log = await events();
  const after = log.filter((e) => e.at >= revokedAt);
  const emptied = after.findIndex((e) => e.event === "read" && e.rows === 0);
  const wiped = after.findIndex((e) => e.event === "wipe");
  writeFileSync("test-results/live-revocation-log.json", JSON.stringify({ revokedAt, events: after }, null, 1));
  // PowerSync itself removed every synced row before the app's own wipe ran.
  expect(emptied).toBeGreaterThan(-1);
  expect(emptied).toBeLessThan(wiped);
  await context.close();
});
