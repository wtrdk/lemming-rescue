"""Create a small, authentic level preview for the self-hosted login page."""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LEVEL_ID = "fun-1"
VIEW = (680, 0, 1000, 160)

levels = json.loads((ROOT / "public/assets/classic/levels.json").read_text())
styles = json.loads((ROOT / "public/assets/classic/atlas.json").read_text())
level = next(item for item in levels if item["id"] == LEVEL_ID)
style = styles[level["style"]]
sheet = Image.open(ROOT / f"public/assets/classic/style-{style['id']}.png").convert("RGBA")
width, height = level["width"], level["height"]
background = Image.new("RGBA", (width, height), tuple(style["palette"][0]) + (255,))


def crop(frame, flip=False):
    image = sheet.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))
    return image.transpose(Image.Transpose.FLIP_TOP_BOTTOM) if flip else image


objects = {item["id"]: item for item in style["objects"]}


def draw_objects(canvas, behind):
    for placement in level["objects"]:
        # The game draws no-overwrite objects behind the terrain and the rest in front.
        if placement["noOverwrite"] != behind:
            continue
        meta = objects[placement["id"]]
        frame_index = min(len(meta["frames"]) - 1, 9 if meta["kind"] == "entrance" else 0)
        canvas.alpha_composite(crop(meta["frames"][frame_index], placement.get("flip", False)),
                               (placement["x"], placement["y"]))


draw_objects(background, True)
terrain = Image.new("RGBA", (width, height), (0, 0, 0, 0))
terrain_frames = {frame["id"]: frame for frame in style["terrain"]}
for placement in level["terrain"]:
    image = crop(terrain_frames[placement["id"]], placement.get("flip", False))
    x, y = placement["x"], placement["y"]
    box = (max(0, x), max(0, y), min(width, x + image.width), min(height, y + image.height))
    if box[2] <= box[0] or box[3] <= box[1]:
        continue
    image = image.crop((box[0] - x, box[1] - y, box[2] - x, box[3] - y))
    prior = terrain.crop(box)
    src, dst = image.load(), prior.load()
    for py in range(image.height):
        for px in range(image.width):
            color = src[px, py]
            if not color[3]:
                continue
            if placement.get("erase"):
                dst[px, py] = (0, 0, 0, 0)
            elif not placement.get("behind") or not dst[px, py][3]:
                dst[px, py] = color
    terrain.paste(prior, box[:2])

background.alpha_composite(terrain)
draw_objects(background, False)
preview = background.crop(VIEW)
preview.save(ROOT / "public/assets/login-level.png", optimize=True)
print("Login level preview aangemaakt uit Amiga-level Fun 1.")
