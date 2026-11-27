"""Screenshot every route of the app at its intended size.

Needs the built app served at http://localhost:4173 (npm run build && npm run
preview). Needs Python with Playwright installed. From the repo root:
    python app/scripts/screenshot.py [names...]
"""
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173"
OUT = Path(__file__).resolve().parents[2] / "capture" / "screenshots" / "stage-2a"
OUT.mkdir(parents=True, exist_ok=True)

TABLET = {"width": 1180, "height": 820}
DESKTOP = {"width": 1440, "height": 900}
PHONE = {"width": 390, "height": 844}

ONLY = set(sys.argv[1:])
errors: list[str] = []


def shot(page, name, full=False, wait=350):
    if ONLY and name not in ONLY:
        return
    page.wait_for_timeout(wait)
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)
    print("saved", name)


def go(page, path, wait=700):
    page.goto(BASE + path)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(wait)


def context(browser, vp):
    ctx = browser.new_context(viewport=vp, device_scale_factor=2, locale="en-GB", timezone_id="Europe/London")
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(f"console {m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    return ctx, page


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---------- Tablet ----------
    ctx, page = context(browser, TABLET)
    go(page, "/signin", 1000)
    shot(page, "01-signin")
    page.get_by_role("button", name="Tom Ashworth").click()
    page.wait_for_timeout(600)
    for d in "12":
        page.get_by_role("button", name=d, exact=True).click()
    shot(page, "02-signin-pin")
    for d in "99":
        page.get_by_role("button", name=d, exact=True).click()
    page.wait_for_timeout(500)
    shot(page, "03-signin-wrong-pin")
    for d in "1234":
        page.get_by_role("button", name=d, exact=True).click()
    page.wait_for_timeout(900)
    shot(page, "04-signin-then-my-jobs")
    go(page, "/signin/office?dev=reset")
    shot(page, "05-office-signin")
    page.get_by_label("Password").fill("nope")
    page.get_by_role("button", name="Sign in").click()
    page.wait_for_timeout(400)
    shot(page, "06-office-signin-wrong")

    go(page, "/jobs?as=p-tom")
    shot(page, "10-my-jobs")
    go(page, "/jobs?as=p-tom&dev=offline")
    shot(page, "11-my-jobs-offline")
    go(page, "/jobs?as=p-tom&dev=loading")
    shot(page, "12-my-jobs-loading")
    go(page, "/jobs?as=p-tom&dev=error")
    shot(page, "13-my-jobs-error")
    go(page, "/jobs?as=p-ryan")
    shot(page, "14-my-jobs-empty")

    # The signature moment: pass the job on.
    go(page, "/jobs?as=p-tom")
    page.get_by_role("button", name="Bench work done").click()
    page.wait_for_timeout(200)
    shot(page, "15-my-jobs-passing", wait=0)
    page.wait_for_timeout(1400)
    shot(page, "16-my-jobs-after-pass")
    page.get_by_role("button", name="Undo").click()
    page.wait_for_timeout(1200)
    shot(page, "17-my-jobs-after-undo")

    go(page, "/job/J-1042?as=p-tom")
    shot(page, "20-job-J-1042")
    shot(page, "21-job-J-1042-full", full=True)
    page.get_by_role("button", name="Open drawing").click()
    page.wait_for_timeout(700)
    shot(page, "22-drawing-viewer")
    page.get_by_role("tab", name="Rev B").click()
    page.wait_for_timeout(500)
    shot(page, "23-drawing-viewer-superseded")
    page.get_by_role("button", name="Close drawing").click()
    page.wait_for_timeout(500)
    page.get_by_role("button", name="Raise a drawing query").click()
    page.wait_for_timeout(700)
    page.get_by_label("What's wrong, or unclear?").fill("Back panel height on rev C reads 2100 but the carcass shoulder only allows 2050. Which is right?")
    page.get_by_role("button", name="Add a photo").click()
    shot(page, "24-raise-query")
    page.get_by_role("button", name="Send to Drawing Review").click()
    page.wait_for_timeout(900)
    shot(page, "25-job-in-review")

    go(page, "/job/J-1042?as=p-tom&dev=fail")
    page.get_by_role("button", name="Raise a drawing query").click()
    page.wait_for_timeout(700)
    page.get_by_label("What's wrong, or unclear?").fill("Back panel height on rev C reads 2100 but the carcass shoulder only allows 2050.")
    page.get_by_role("button", name="Send to Drawing Review").click()
    page.wait_for_timeout(700)
    shot(page, "26-query-failed")

    go(page, "/job/J-1042?as=p-tom&dev=loading")
    shot(page, "27-job-loading")
    go(page, "/job/J-9999?as=p-tom")
    shot(page, "28-job-missing")

    go(page, "/job/J-1045?as=p-tom")
    shot(page, "30-gate-drawing-job")
    page.get_by_role("button", name="Move to Materials").click()
    page.wait_for_timeout(1000)
    shot(page, "31-gate-drawing-refused")

    go(page, "/job/J-1049?as=p-tom")
    page.get_by_role("button", name="Mark delivered").click()
    page.wait_for_timeout(900)
    shot(page, "32-permission-denied")

    go(page, "/job/J-1047?as=p-steve")
    page.get_by_role("button", name="Move to CNC").click()
    page.wait_for_timeout(1000)
    shot(page, "33-materials-warning")
    page.get_by_role("button", name="Move to CNC anyway").click()
    page.wait_for_timeout(1200)
    shot(page, "34-materials-moved")

    go(page, "/job/J-1042?as=p-steve&dev=conflict")
    page.get_by_role("button", name="Bench work done").click()
    page.wait_for_timeout(1100)
    shot(page, "35-conflict")
    page.get_by_role("button", name="Use mine").click()
    page.wait_for_timeout(1200)
    shot(page, "36-conflict-resolved-mine")

    go(page, "/job/J-1042?as=p-tom&dev=offline")
    page.get_by_role("button", name="Bench work done").click()
    page.wait_for_timeout(1100)
    shot(page, "37-job-offline-queued")
    ctx.close()

    # ---------- Desktop ----------
    ctx, page = context(browser, DESKTOP)
    go(page, "/board?as=p-steve")
    shot(page, "50-board")
    go(page, "/board?as=p-steve&dev=loading")
    shot(page, "51-board-loading")
    go(page, "/board?as=p-steve&dev=error")
    shot(page, "52-board-error")
    go(page, "/board?as=p-helen")
    shot(page, "53-board-director")
    go(page, "/today?as=p-steve")
    shot(page, "54-today")
    go(page, "/today?as=p-steve&dev=loading")
    shot(page, "55-today-loading")
    go(page, "/settings?as=p-steve")
    shot(page, "56-settings-people")
    go(page, "/job/J-1042?as=p-steve")
    shot(page, "57-job-desktop-manager")
    go(page, "/nowhere?as=p-steve")
    shot(page, "58-not-found")
    go(page, "/design-system", 1200)
    shot(page, "60-design-system")
    shot(page, "61-design-system-full", full=True)
    ctx.close()

    # ---------- Phone ----------
    ctx, page = context(browser, PHONE)
    go(page, "/signin?dev=reset", 900)
    shot(page, "70-signin-phone")
    go(page, "/jobs?as=p-tom")
    shot(page, "71-my-jobs-phone")
    shot(page, "72-my-jobs-phone-full", full=True)
    go(page, "/job/J-1042?as=p-tom")
    shot(page, "73-job-phone")
    shot(page, "74-job-phone-full", full=True)
    go(page, "/jobs?as=p-tom&dev=offline")
    shot(page, "75-my-jobs-phone-offline")
    ctx.close()

    browser.close()

if errors:
    print("\nBrowser errors:")
    for e in errors:
        print(" ", e)
