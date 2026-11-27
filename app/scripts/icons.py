"""Rasterise the Arris mark into the PWA icon set. The mark is the wordmark's
square with one arris eased and the offcut in the accent. Needs Python with
Playwright installed. From the repo root:
    python app/scripts/icons.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / "public" / "icons"
MARK = '<path d="M6 2h7.5L22 10.5V18a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z" fill="#15181D"/><path d="M16.5 2H18a4 4 0 0 1 4 4v1.5Z" fill="#8C5A2B"/>'

def page_html(size: int, pad: float, bg: str, radius: float) -> str:
    inner = size * (1 - 2 * pad)
    off = size * pad
    return f"""<!doctype html><html><body style="margin:0;background:transparent">
    <div style="width:{size}px;height:{size}px;background:{bg};border-radius:{radius}px;display:grid;place-items:center">
      <svg width="{inner}" height="{inner}" viewBox="0 0 24 24">{MARK}</svg>
    </div></body></html>"""

SPECS = [
    # name, size, padding fraction, background, corner radius
    ("icon-192.png", 192, 0.14, "#F2F3F5", 40),
    ("icon-512.png", 512, 0.14, "#F2F3F5", 108),
    ("icon-maskable-512.png", 512, 0.24, "#F2F3F5", 0),
    ("apple-touch-icon.png", 180, 0.16, "#F2F3F5", 0),
]

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, size, pad, bg, radius in SPECS:
        pg = b.new_page(viewport={"width": size, "height": size}, device_scale_factor=1)
        pg.set_content(page_html(size, pad, bg, radius))
        pg.screenshot(path=str(OUT / name), omit_background=True, clip={"x": 0, "y": 0, "width": size, "height": size})
        print("wrote", name)
    b.close()
