"""Screenshot every screen of direction A at its intended size.

Needs Python with Playwright installed (pip install playwright, then
playwright install chromium). From the repo root:
    python design/direction-a/scripts/screenshot.py
"""
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
DIST = ROOT / "design/direction-a/dist/index.html"
OUT = ROOT / "capture/screenshots/design-pass/direction-a"
OUT.mkdir(parents=True, exist_ok=True)

TABLET = {"width": 1180, "height": 820}
DESKTOP = {"width": 1440, "height": 900}
PHONE = {"width": 390, "height": 844}

ONLY = set(sys.argv[1:])


def shot(page, name, full=False):
    if ONLY and name not in ONLY:
        return
    page.wait_for_timeout(250)
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)
    print("saved", name)


def nav(page, hash_):
    page.evaluate(f"window.location.hash = {hash_!r}")
    page.wait_for_timeout(350)


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---------- Tablet ----------
    ctx = browser.new_context(viewport=TABLET, device_scale_factor=2)
    page = ctx.new_page()
    page.on("console", lambda m: print("console:", m.type, m.text) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: print("pageerror:", e))
    page.goto(DIST.as_uri() + "#/signin")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(900)
    shot(page, "01-signin")
    page.get_by_role("button", name="Gareth Holt").click()
    for d in "123":
        page.get_by_role("button", name=d, exact=True).click()
    shot(page, "02-signin-pin")
    page.get_by_role("button", name="5", exact=True).click()
    page.wait_for_timeout(400)
    shot(page, "03-signin-pin-wrong")
    nav(page, "#/signin/office")
    shot(page, "04-signin-office")

    nav(page, "#/jobs?as=tom")
    shot(page, "10-myjobs")
    nav(page, "#/jobs?as=tom&offline=1")
    shot(page, "11-myjobs-offline")
    nav(page, "#/jobs?as=tom&offline=0&loading=1")
    shot(page, "12-myjobs-loading")
    nav(page, "#/jobs?as=ryan&loading=0")
    shot(page, "13-myjobs-empty")

    # The signature moment: pass the job on, catch the ticket mid-slide.
    nav(page, "#/jobs?as=tom")
    page.get_by_role("button", name="Done at Bench, pass to Spray Booth").click()
    page.wait_for_timeout(230)
    page.screenshot(path=str(OUT / "14-myjobs-passing.png"))
    print("saved 14-myjobs-passing")
    page.wait_for_timeout(900)
    shot(page, "15-myjobs-after-pass")

    # Job page. Reload to reset state so J-1042 is back at Bench.
    page.goto("about:blank")
    page.goto(DIST.as_uri() + "#/job/J-1042?as=tom")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(700)
    shot(page, "20-job-drawing")
    page.get_by_role("tab", name="Cutting list").click()
    shot(page, "21-job-cutting-list")
    page.get_by_role("button", name="Shelves: Cut. Mark edged").click()
    page.wait_for_timeout(200)
    shot(page, "22-job-cutting-list-advanced")
    page.get_by_role("tab", name="Materials").click()
    shot(page, "23-job-materials")
    page.get_by_role("tab", name="Notes & history").click()
    shot(page, "24-job-notes")
    nav(page, "#/job/J-1042/drawing?rev=C&as=tom")
    page.wait_for_timeout(300)
    shot(page, "25-drawing-viewer-revC")
    nav(page, "#/job/J-1042/drawing?rev=B&as=tom")
    shot(page, "26-drawing-viewer-revB-superseded")
    nav(page, "#/job/J-1042?as=tom")
    page.get_by_role("button", name="Raise a drawing query").click()
    page.wait_for_timeout(600)
    page.get_by_label("What's wrong with the drawing?").fill("Back panel height on rev C doesn't match the carcass. 2100 on the elevation, 2050 on the plan.")
    page.get_by_role("button", name="Add a photo").click()
    shot(page, "27-job-query-sheet")
    page.get_by_role("button", name="Send to Drawing Review").click()
    page.wait_for_timeout(700)
    shot(page, "28-job-in-review")

    # Gates. Fresh page so J-1042's query above doesn't leak into these.
    page.goto("about:blank")
    page.goto(DIST.as_uri() + "#/job/J-1045?as=steve")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(700)
    shot(page, "30-gate-drawing-job")
    page.get_by_role("button", name="Pass to Materials").click()
    page.wait_for_timeout(400)
    shot(page, "31-gate-drawing-blocked")
    nav(page, "#/job/J-1047?as=steve")
    page.wait_for_timeout(300)
    page.get_by_role("button", name="Done at Materials, pass to CNC / Machining").click()
    page.wait_for_timeout(400)
    shot(page, "32-gate-materials-warning")

    # States on the job page
    nav(page, "#/job/J-1049?as=tom")
    page.wait_for_timeout(300)
    page.get_by_role("button", name="Mark as Delivered").click()
    page.wait_for_timeout(400)
    shot(page, "40-state-permission-denied")
    nav(page, "#/job/J-1042?as=steve&conflict=1")
    page.wait_for_timeout(300)
    page.get_by_role("button", name="Done at Bench, pass to Spray Booth").click()
    page.wait_for_timeout(400)
    shot(page, "41-state-conflict")
    nav(page, "#/job/J-1043?as=tom&error=1")
    page.wait_for_timeout(300)
    page.get_by_role("button", name="Done at Spray, pass to Quality Check").click()
    page.wait_for_timeout(400)
    shot(page, "42-state-error")
    nav(page, "#/states")
    shot(page, "43-states-index")
    ctx.close()

    # ---------- Desktop board, with a query in the lane ----------
    ctx = browser.new_context(viewport=DESKTOP, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(DIST.as_uri() + "#/job/J-1042?as=tom")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(700)
    page.get_by_role("button", name="Raise a drawing query").click()
    page.wait_for_timeout(600)
    page.get_by_label("What's wrong with the drawing?").fill("Back panel height doesn't match the carcass.")
    page.get_by_role("button", name="Send to Drawing Review").click()
    page.wait_for_timeout(500)
    nav(page, "#/board?as=steve")
    page.wait_for_timeout(500)
    shot(page, "50-board")
    ctx.close()

    # ---------- Phone ----------
    ctx = browser.new_context(viewport=PHONE, device_scale_factor=3, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.goto(DIST.as_uri() + "#/jobs?as=tom")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(900)
    shot(page, "60-myjobs-phone")
    shot(page, "61-myjobs-phone-full", full=True)
    ctx.close()
    browser.close()
