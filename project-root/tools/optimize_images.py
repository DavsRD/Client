"""
Regenerates the web-ready images from the source art. Not shipped with the site.

    python3 tools/optimize_images.py      (run from project-root)

- assets/images/*.png  ->  assets/images/scenes/<slug>.webp      (hero, 1672px)
                           assets/images/scenes/<slug>-thumb.webp (card banners, 640px)
- assets/icons/Mascot@2x.png -> PWA icons (any + maskable) and favicons,
  scaled by whole numbers so the pixels stay crisp.

To add a new background: drop the PNG in assets/images/, add it to SCENES below,
run this script, then add the slug to js/data/scenes.json.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "assets" / "images"
ICONS = ROOT / "assets" / "icons"

SCENES = {
    "Pixel-Art Volcano Lake Vista.png": "volcano-lake",
    "Tropical Volcano Valley in Pixel Art.png": "volcano-valley",
    "Misty Rice Terraces Pixel Valley.png": "rice-terraces",
    "Pixel Tropical Chocolate Hills Vista.png": "chocolate-hills",
    "Vibrant Pixel-Art Harbor Port.png": "harbor-port",
    "Sunlit Pixel Reef Adventure.png": "reef",
    "Pixel Art Monument by the Bay.png": "monument-bay",
    "Pixel Panorama of Misty Mountain Valley.png": "mountain-valley",
}

INDIGO = (59, 42, 143, 255)   # Agila "Indigo" app-icon background
MASCOT_GRID = 60              # Mascot@2x.png is 2160px = 60 art pixels x 36px


def scenes():
    out = IMAGES / "scenes"
    out.mkdir(exist_ok=True)
    for src, slug in SCENES.items():
        im = Image.open(IMAGES / src).convert("RGB")
        im.save(out / f"{slug}.webp", "WEBP", quality=80, method=6)
        w, h = im.size
        thumb = im.resize((640, round(h * 640 / w)), Image.LANCZOS)
        thumb.save(out / f"{slug}-thumb.webp", "WEBP", quality=78, method=6)


def mascot_icons():
    src = Image.open(ICONS / "Mascot@2x.png").convert("RGBA")
    cell = src.width // MASCOT_GRID
    # Sample the centre of every art pixel to get the true 60x60 sprite.
    art = Image.new("RGBA", (MASCOT_GRID, MASCOT_GRID))
    for y in range(MASCOT_GRID):
        for x in range(MASCOT_GRID):
            art.putpixel((x, y), src.getpixel((x * cell + cell // 2, y * cell + cell // 2)))

    # The source has a white background. Flood-fill it away from the edges so the
    # eagle's white head (enclosed by its outline) stays opaque.
    white = (255, 255, 255, 255)
    stack = [(x, y) for x in range(MASCOT_GRID) for y in (0, MASCOT_GRID - 1)]
    stack += [(x, y) for y in range(MASCOT_GRID) for x in (0, MASCOT_GRID - 1)]
    while stack:
        x, y = stack.pop()
        if 0 <= x < MASCOT_GRID and 0 <= y < MASCOT_GRID and art.getpixel((x, y)) == white:
            art.putpixel((x, y), (0, 0, 0, 0))
            stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]

    def make(size, art_scale, bg, name):
        canvas = Image.new("RGBA", (size, size), bg)
        sprite = art.resize((MASCOT_GRID * art_scale,) * 2, Image.NEAREST)
        off = (size - sprite.width) // 2
        canvas.alpha_composite(sprite, (off, off))
        canvas.save(ICONS / name)

    make(192, 3, INDIGO, "icon-192.png")           # 180px art
    make(512, 8, INDIGO, "icon-512.png")           # 480px art
    make(192, 2, INDIGO, "icon-maskable-192.png")  # 120px art, inside the 80% safe zone
    make(512, 6, INDIGO, "icon-maskable-512.png")  # 360px art
    make(180, 3, INDIGO, "apple-touch-icon.png")
    make(64, 1, (0, 0, 0, 0), "favicon-64.png")


if __name__ == "__main__":
    scenes()
    mascot_icons()
    print("done")
