"""Screenshot every screen of direction B once at its intended size.

Needs Python with Playwright installed. From the repo root:
  python design/direction-b/scripts/screenshot.py
"""

import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[3]
DIST = ROOT / "design/direction-b/dist/index.html"
OUT = ROOT / "capture/screenshots/design-pass/direction-b"
OUT.mkdir(parents=True, exist_ok=True)

TABLET = {"width": 1180, "height": 820}
DESKTOP = {"width": 1440, "height": 900}
PHONE = {"width": 390, "height": 844}


def settle(page, ms=350):
    page.wait_for_timeout(ms)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(120)


def shot(page, name, full=False):
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path), full_page=full)
    print("saved", path.name)


def main():
    url = DIST.as_uri()
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---- Tablet ----
        ctx = browser.new_context(viewport=TABLET, device_scale_factor=1, locale="en-GB")
        page = ctx.new_page()
        page.goto(url + "#/signin")
        settle(page, 900)
        shot(page, "01-signin")

        page.get_by_role("button", name="TA Tom Ashworth").click()
        settle(page)
        shot(page, "02-signin-pin")

        for k in "1235":
            page.get_by_role("button", name=k, exact=True).click()
        settle(page, 700)
        shot(page, "03-signin-wrong-pin")

        page.goto(url + "#/office")
        settle(page)
        shot(page, "04-office-signin")

        page.goto(url + "#/jobs?as=tom")
        settle(page, 500)
        shot(page, "05-my-jobs")
        shot(page, "05-my-jobs-full", full=True)

        page.goto(url + "#/jobs?as=tom&offline=1")
        settle(page, 400)
        shot(page, "06-my-jobs-offline")

        page.goto(url + "#/jobs?as=tom&offline=0&loading=1")
        page.wait_for_timeout(250)
        shot(page, "07-my-jobs-loading")
        settle(page, 1600)

        page.goto(url + "#/jobs?as=ryan")
        settle(page, 400)
        shot(page, "08-my-jobs-empty")

        page.goto(url + "#/job/J-1042?as=tom")
        settle(page, 500)
        shot(page, "09-job-J-1042")
        shot(page, "09-job-J-1042-full", full=True)

        page.goto(url + "#/job/J-1042/drawing?as=tom")
        page.wait_for_timeout(700)
        shot(page, "10-drawing-viewer-drawing-in")
        settle(page, 2200)
        shot(page, "10-drawing-viewer-rev-c")

        page.goto(url + "#/job/J-1042/drawing?as=tom&rev=B")
        settle(page, 2400)
        shot(page, "11-drawing-viewer-rev-b-superseded")

        page.goto(url + "#/job/J-1042?as=tom")
        settle(page, 400)
        page.get_by_role("button", name="Raise a drawing query").click()
        settle(page, 600)
        page.get_by_placeholder("For example").fill("Back panel height on the rear elevation reads 2100 but the plan says 2000. Which is right?")
        page.get_by_role("button", name="Add a photo").click()
        settle(page, 300)
        shot(page, "12-raise-drawing-query")
        page.get_by_role("button", name="Send to Drawing Review").click()
        settle(page, 700)
        shot(page, "13-job-in-drawing-review")

        # Cutting list: advance one component so the step control shows a change
        page.get_by_role("button", name="Shelves: Cut.", exact=False).click()
        settle(page, 400)

        # Gates
        page.goto(url + "#/job/J-1045?as=steve")
        settle(page, 400)
        shot(page, "14-gate-drawing-J-1045-locked")
        page.get_by_role("button", name="Move to Materials").first.click()
        settle(page, 500)
        shot(page, "15-gate-drawing-blocked-dialog")
        page.get_by_role("dialog").get_by_role("button", name="Upload approved drawing").click()
        settle(page, 1900)
        shot(page, "16-gate-drawing-stamped-open")
        page.keyboard.press("Escape")
        settle(page, 400)
        shot(page, "17-gate-drawing-job-after-approval")

        page.goto(url + "#/job/J-1047?as=steve&gate=1")
        settle(page, 600)
        shot(page, "18-gate-materials-check")

        # States
        page.goto(url + "#/job/J-1042?as=tom&conflict=1")
        settle(page, 600)
        shot(page, "19-state-conflict")

        page.goto(url + "#/job/J-1049?as=tom&denied=1")
        settle(page, 600)
        shot(page, "20-state-permission-denied")

        page.goto(url + "#/job/J-1042?as=tom&error=1")
        settle(page, 600)
        shot(page, "21-state-error")

        # Prototype menu open
        page.goto(url + "#/jobs?as=tom")
        settle(page, 300)
        page.get_by_role("button", name="Prototype").click()
        settle(page, 300)
        shot(page, "22-prototype-menu")

        # ---- Desktop board, same context so the raised query is still in memory ----
        page.set_viewport_size(DESKTOP)
        page.goto(url + "#/board?as=steve")
        settle(page, 600)
        shot(page, "23-board")

        page.goto(url + "#/board?as=steve&loading=1")
        page.wait_for_timeout(300)
        shot(page, "24-board-loading")
        settle(page, 1500)

        page.goto(url + "#/job/J-1042?as=steve")
        settle(page, 500)
        shot(page, "25-job-desktop-manager")

        ctx.close()

        # ---- Phone ----
        ctx = browser.new_context(viewport=PHONE, device_scale_factor=2, is_mobile=True, has_touch=True, locale="en-GB")
        page = ctx.new_page()
        page.goto(url + "#/jobs?as=tom")
        settle(page, 900)
        shot(page, "26-my-jobs-phone")
        shot(page, "26-my-jobs-phone-full", full=True)
        page.goto(url + "#/signin")
        settle(page, 400)
        shot(page, "27-signin-phone")
        ctx.close()
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
