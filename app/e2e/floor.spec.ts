import { expect, test } from "@playwright/test";

// The floor's one obvious path, recorded: sign in with a PIN, see the next job,
// pass it on, undo. Video is recorded for every run (see playwright.config.ts).
// These run on the in-memory sample workshop (?source=memory), with the same
// demo PINs as the server. live.spec.ts runs against the real back end.

test.describe("floor", () => {
  test("signs in with a PIN and passes a job on", async ({ page }) => {
    await page.goto("/signin?source=memory&dev=reset");
    await expect(page.getByRole("heading", { name: "Who's working?" })).toBeVisible();

    await page.getByRole("button", { name: "Tom Ashworth" }).click();
    for (const d of "4826") await page.getByRole("button", { name: d, exact: true }).click();

    await expect(page.getByRole("heading", { name: "Next for you" })).toBeVisible();
    await expect(page.getByRole("article", { name: /J-1042/ })).toBeVisible();

    await page.getByRole("button", { name: "Bench work done" }).click();
    await expect(page.getByRole("status").filter({ hasText: "J-1042 passed to Spray Booth" })).toBeVisible();
    await expect(page.getByRole("article", { name: /J-1046/ })).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("article", { name: /J-1042/ })).toBeVisible();
  });

  test("refuses the wrong PIN with a reason", async ({ page }) => {
    await page.goto("/signin?source=memory&dev=reset");
    await page.getByRole("button", { name: "Tom Ashworth" }).click();
    for (const d of "9999") await page.getByRole("button", { name: d, exact: true }).click();
    await expect(page.getByText("That PIN didn't match")).toBeVisible();
  });

  test("the drawing gate blocks J-1045 and says why", async ({ page }) => {
    await page.goto("/job/J-1045?source=memory&as=p-tom");
    await page.getByRole("button", { name: "Move to Materials" }).click();
    await expect(page.getByRole("dialog", { name: "This job needs an approved drawing first" })).toBeVisible();
  });

  test("a change from another device shows as a conflict", async ({ page }) => {
    await page.goto("/job/J-1042?source=memory&as=p-steve&dev=conflict");
    await page.getByRole("button", { name: "Bench work done" }).click();
    const dialog = page.getByRole("dialog", { name: /Tom changed this job on the bench tablet/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Use mine" }).click();
    await expect(page.getByRole("status").filter({ hasText: "J-1042 moved to Spray Booth" })).toBeVisible();
  });
});

test.describe("late outcomes", () => {
  test("a change made offline and refused later is shown, with the choices", async ({ page }) => {
    await page.goto("/jobs?source=memory&dev=reset");
    await page.goto("/jobs?source=memory&as=p-tom&dev=late");
    const dialog = page.getByRole("dialog", { name: /Steve changed J-1042 before your change arrived/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/While this tablet was offline, you tried to move J-1042 to Spray Booth/)).toBeVisible();
    await dialog.getByRole("button", { name: "Keep Steve's change" }).click();
    await expect(dialog).toBeHidden();
  });
});
