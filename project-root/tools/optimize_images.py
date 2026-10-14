"""
Regenerates the web-ready images from the source art. Not shipped with the site.

    python3 tools/optimize_images.py      (run from project-root)

- assets/images/*.png  ->  assets/images/scenes/<slug>.webp      (hero, 1672px)
                           assets/images/scenes/<slug>-thumb.webp (card banners, 640px)
- the geared Agila icon sprite -> PWA icons (any + maskable), apple-touch icon and
  favicon on an indigo tile, scaled by whole numbers so the pixels stay crisp.

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
SPRITES = ROOT / "assets" / "pixel-eagle-sprites" / "png" / "1x"
ICON_ART = SPRITES / "icon_indigo_geared.png"   # 32x32 geared Agila, transparent background


def rounded_tile(size, radius):
    """Indigo square with stepped (pixel) rounded corners."""
    tile = Image.new("RGBA", (size, size), INDIGO)
    for y in range(radius):
        for x in range(radius):
            # Outside the quarter circle -> transparent, in all four corners.
            if (radius - x - 0.5) ** 2 + (radius - y - 0.5) ** 2 > radius ** 2:
                for cx, cy in ((x, y), (size - 1 - x, y), (x, size - 1 - y), (size - 1 - x, size - 1 - y)):
                    tile.putpixel((cx, cy), (0, 0, 0, 0))
    return tile


def mascot_icons():
    art = Image.open(ICON_ART).convert("RGBA")

    def make(size, art_scale, name, tile_radius=None):
        canvas = rounded_tile(size, tile_radius) if tile_radius else Image.new("RGBA", (size, size), INDIGO)
        sprite = art.resize((art.width * art_scale, art.height * art_scale), Image.NEAREST)
        off = (size - sprite.width) // 2
        canvas.alpha_composite(sprite, (off, off))
        canvas.save(ICONS / name)

    # Whole-number scales only, so every art pixel stays square and crisp.
    make(192, 6, "icon-192.png")            # 192px art, full bleed
    make(512, 16, "icon-512.png")           # 512px art, full bleed
    make(192, 4, "icon-maskable-192.png")   # 128px art, inside the 80% safe zone
    make(512, 12, "icon-maskable-512.png")  # 384px art
    make(180, 5, "apple-touch-icon.png")    # 160px art
    make(64, 2, "favicon-64.png", tile_radius=10)  # header brand + browser tab


if __name__ == "__main__":
    scenes()
    mascot_icons()
    print("done")
