"""
Regenerates the web-ready images from the source art. Not shipped with the site.

    python3 tools/optimize_images.py      (run from project-root)

- assets/images/*.png  ->  assets/images/scenes/<slug>.webp      (hero, 1672px)
                           assets/images/scenes/<slug>-thumb.webp (card banners, 640px)
- assets/images/Thumbnails/16:9/*.jpeg -> assets/images/hazards/<id>.webp (hazard page header, 1376px)
                                          assets/images/hazards/<id>-thumb.webp (hazard cards, 640px)
- assets/images/Thumbnails/1x1/*.jpeg  -> assets/icons/hazards/<id>.webp (the one icon per hazard, 160px)
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

# Hazard art: hazard id -> (16:9 file, 1x1 file) in assets/images/Thumbnails/.
THUMBNAILS = IMAGES / "Thumbnails"
HAZARD_ART = {
    "earthquake": ("earthquake.jpeg", "1x1-earthquake.jpeg"),
    "volcanic-eruption": ("volcano.jpeg", "1x1-volcano-erupt.jpeg"),
    "tsunami": ("tsunami.jpeg", "1x1-tsunami.jpeg"),
    "landslide": ("landslide.jpeg", "1x1-landslide.jpeg"),
    "typhoon": ("typhoon.jpeg", "1x1-typhoon.jpeg"),
    "severe-flooding": ("flood.jpeg", "1x1-flood.jpeg"),
    "storm-surge": ("surge.jpeg", "1x1-surge.jpeg"),
    "el-nino": ("Elnino.jpeg", "1x1-elNino.jpeg"),
    "disease-outbreak": ("disease.jpeg", "1x1-disease.jpeg"),
    "pest-infestation": ("pest.jpeg", "1x1-pest.jpeg"),
    "fire": ("fire.jpeg", "1x1-fires.jpeg"),
    "structural-collapse": ("collapse.jpeg", "1x1-collapse.jpeg"),
    "road-accidents": ("roads.jpeg", "1x1-roads.jpeg"),
    "chemical-spill": ("spill.jpeg", "1x1-spill.jpeg"),
    "electrical-hazards": ("electric.jpeg", "1x1-electric.jpeg"),
    "missing-child": ("stranger.jpeg", "1x1-stranger.jpeg"),
    "bullying": ("bully.jpeg", "1x1-bully.jpeg"),
    "crowd-crush": ("crowd.jpeg", "1x1-crowd.jpeg"),
    "community-conflict": ("conflict.jpeg", "1x1-conflict.jpeg"),
}

INDIGO = (59, 42, 143, 255)   # Agila "Indigo" app-icon background
SPRITES = ROOT / "assets" / "pixel-eagle-sprites" / "png" / "1x"
ICON_ART = SPRITES / "icon_indigo_geared.png"   # 32x32 geared Agila, transparent background


def hazard_art():
    # "16:9" isn't a valid folder name on Windows; accept "16x9" too if it gets renamed.
    wide_dir = next(d for d in (THUMBNAILS / "16:9", THUMBNAILS / "16x9") if d.exists())
    square_dir = THUMBNAILS / "1x1"
    banners = IMAGES / "hazards"
    icons = ICONS / "hazards"
    banners.mkdir(exist_ok=True)
    icons.mkdir(exist_ok=True)

    for hazard_id, (wide_file, square_file) in HAZARD_ART.items():
        wide = Image.open(wide_dir / wide_file).convert("RGB")
        wide.save(banners / f"{hazard_id}.webp", "WEBP", quality=80, method=6)
        w, h = wide.size
        wide.resize((640, round(h * 640 / w)), Image.LANCZOS).save(
            banners / f"{hazard_id}-thumb.webp", "WEBP", quality=78, method=6
        )
        square = Image.open(square_dir / square_file).convert("RGB")
        square.resize((160, 160), Image.LANCZOS).save(icons / f"{hazard_id}.webp", "WEBP", quality=82, method=6)


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
    hazard_art()
    mascot_icons()
    print("done")
