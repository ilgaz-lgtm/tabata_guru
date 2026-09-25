#!/usr/bin/env python3
"""Renders the app icons from a single vector-ish definition.

Run with `python3 scripts/generate-icons.py` after changing the brand colours.
"""

from pathlib import Path

from PIL import Image, ImageDraw

INK = (5, 5, 6, 255)
WORK = (255, 90, 77, 255)
LINE = (30, 30, 36, 255)
CHALK = (242, 242, 244, 255)

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"
SUPERSAMPLE = 4


def render(size: int, maskable: bool) -> Image.Image:
    canvas = size * SUPERSAMPLE
    image = Image.new("RGBA", (canvas, canvas), INK)
    draw = ImageDraw.Draw(image)

    # Maskable icons must survive an aggressive circular crop.
    inset = canvas * (0.28 if maskable else 0.16)
    box = (inset, inset, canvas - inset, canvas - inset)
    width = int(canvas * 0.055)

    draw.ellipse(box, outline=LINE, width=width)
    # Open arc: the 20s work interval of a classic Tabata round.
    draw.arc(box, start=-90, end=110, fill=WORK, width=width)

    bar_w = int(canvas * 0.045)
    bar_h = int(canvas * 0.16)
    cx, cy = canvas / 2, canvas / 2
    draw.rounded_rectangle(
        (cx - bar_w / 2, cy - bar_h / 2, cx + bar_w / 2, cy + bar_h / 2),
        radius=bar_w / 2,
        fill=CHALK,
    )

    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("apple-touch-icon.png", 180, False),
        ("maskable-512.png", 512, True),
        ("favicon-32.png", 32, False),
    ]
    for name, size, maskable in targets:
        render(size, maskable).save(OUT_DIR / name)
        print(f"wrote {OUT_DIR / name}")


if __name__ == "__main__":
    main()
