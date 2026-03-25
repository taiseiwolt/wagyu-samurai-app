#!/usr/bin/env python3
"""
Test WAGYU SAMURAI LUT by:
1. Creating 5 reference test images simulating different lighting conditions
2. Applying the .cube LUT to each
3. Generating Before/After comparison images (side by side)
"""

import os
import math
import struct
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LUT_PATH = os.path.join(PROJECT_DIR, "public", "assets", "lut", "wagyu_samurai.cube")
SAMPLES_DIR = os.path.join(PROJECT_DIR, "public", "assets", "lut", "samples")
IMG_SIZE = (600, 400)


# --- Parse .cube LUT ---

def parse_cube_lut(path):
    """Parse a .cube file and return (size, data) where data is flat list of (r,g,b) tuples."""
    size = 0
    data = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("TITLE") or line.startswith("DOMAIN"):
                continue
            if line.startswith("LUT_3D_SIZE"):
                size = int(line.split()[-1])
                continue
            parts = line.split()
            if len(parts) == 3:
                data.append((float(parts[0]), float(parts[1]), float(parts[2])))
    return size, data


def apply_lut_to_pixel(r, g, b, size, data):
    """Trilinear interpolation lookup in 3D LUT."""
    r = max(0.0, min(1.0, r))
    g = max(0.0, min(1.0, g))
    b = max(0.0, min(1.0, b))

    # Scale to LUT indices
    ri = r * (size - 1)
    gi = g * (size - 1)
    bi = b * (size - 1)

    r0 = int(math.floor(ri))
    g0 = int(math.floor(gi))
    b0 = int(math.floor(bi))
    r1 = min(r0 + 1, size - 1)
    g1 = min(g0 + 1, size - 1)
    b1 = min(b0 + 1, size - 1)

    fr = ri - r0
    fg = gi - g0
    fb = bi - b0

    def idx(ri, gi, bi):
        return bi * size * size + gi * size + ri

    # Trilinear interpolation
    def lerp(a, b, t):
        return a + (b - a) * t

    def lerp3(c000, c100, c010, c110, c001, c101, c011, c111):
        c00 = tuple(lerp(c000[i], c100[i], fr) for i in range(3))
        c01 = tuple(lerp(c001[i], c101[i], fr) for i in range(3))
        c10 = tuple(lerp(c010[i], c110[i], fr) for i in range(3))
        c11 = tuple(lerp(c011[i], c111[i], fr) for i in range(3))
        c0 = tuple(lerp(c00[i], c10[i], fg) for i in range(3))
        c1 = tuple(lerp(c01[i], c11[i], fg) for i in range(3))
        return tuple(lerp(c0[i], c1[i], fb) for i in range(3))

    c000 = data[idx(r0, g0, b0)]
    c100 = data[idx(r1, g0, b0)]
    c010 = data[idx(r0, g1, b0)]
    c110 = data[idx(r1, g1, b0)]
    c001 = data[idx(r0, g0, b1)]
    c101 = data[idx(r1, g0, b1)]
    c011 = data[idx(r0, g1, b1)]
    c111 = data[idx(r1, g1, b1)]

    return lerp3(c000, c100, c010, c110, c001, c101, c011, c111)


def apply_lut_to_image(img, size, data):
    """Apply LUT to a PIL Image."""
    pixels = img.load()
    w, h = img.size
    out = Image.new("RGB", (w, h))
    out_pixels = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y][:3]
            ro, go, bo = apply_lut_to_pixel(r / 255.0, g / 255.0, b / 255.0, size, data)
            out_pixels[x, y] = (
                max(0, min(255, int(ro * 255))),
                max(0, min(255, int(go * 255))),
                max(0, min(255, int(bo * 255))),
            )

    return out


# --- Generate test images ---

def create_gradient_rect(draw, x, y, w, h, color1, color2):
    """Draw a vertical gradient rectangle."""
    for i in range(h):
        t = i / max(1, h - 1)
        r = int(color1[0] + (color2[0] - color1[0]) * t)
        g = int(color1[1] + (color2[1] - color1[1]) * t)
        b = int(color1[2] + (color2[2] - color1[2]) * t)
        draw.line([(x, y + i), (x + w, y + i)], fill=(r, g, b))


def generate_test_images():
    """Create 5 simulated test images for different lighting conditions."""
    images = {}

    # 1. Bright fluorescent — cool tones, high brightness
    img = Image.new("RGB", IMG_SIZE, (240, 238, 245))
    draw = ImageDraw.Draw(img)
    # Meat slab (red)
    create_gradient_rect(draw, 150, 100, 300, 200, (200, 50, 40), (160, 35, 30))
    # Marbling (white streaks)
    for i in range(0, 300, 30):
        draw.line([(150 + i, 120), (170 + i, 280)], fill=(245, 240, 235), width=3)
    # Plate (white)
    draw.ellipse([120, 80, 480, 320], outline=(210, 210, 215), width=3)
    # Label
    draw.text((10, 10), "1. Bright Fluorescent", fill=(60, 60, 60))
    images["01_bright_fluorescent"] = img

    # 2. Dark counter — warm dim lighting
    img = Image.new("RGB", IMG_SIZE, (35, 28, 22))
    draw = ImageDraw.Draw(img)
    # Warm spot light
    create_gradient_rect(draw, 200, 80, 200, 240, (120, 50, 25), (80, 30, 15))
    # Meat (darker, warm lit)
    create_gradient_rect(draw, 220, 120, 160, 160, (150, 45, 30), (100, 30, 20))
    # Marbling
    for i in range(0, 160, 25):
        draw.line([(220 + i, 140), (235 + i, 260)], fill=(180, 160, 140), width=2)
    # Counter surface
    draw.rectangle([0, 330, 600, 400], fill=(25, 20, 16))
    draw.text((10, 10), "2. Dark Counter", fill=(160, 140, 120))
    images["02_dark_counter"] = img

    # 3. Outdoor terrace — blue sky, daylight
    img = Image.new("RGB", IMG_SIZE, (180, 210, 240))
    draw = ImageDraw.Draw(img)
    # Table
    draw.rectangle([50, 200, 550, 400], fill=(200, 180, 160))
    # Plate (white ceramic)
    draw.ellipse([180, 150, 420, 350], fill=(250, 250, 248))
    # Meat
    create_gradient_rect(draw, 220, 190, 160, 120, (180, 55, 40), (140, 40, 30))
    for i in range(0, 160, 20):
        draw.line([(220 + i, 200), (230 + i, 300)], fill=(240, 230, 220), width=2)
    draw.text((10, 10), "3. Outdoor Terrace", fill=(40, 60, 100))
    images["03_outdoor_terrace"] = img

    # 4. Flash photography — overexposed, harsh
    img = Image.new("RGB", IMG_SIZE, (255, 252, 250))
    draw = ImageDraw.Draw(img)
    # Harsh shadows
    draw.rectangle([100, 250, 500, 400], fill=(200, 195, 190))
    # Meat (overexposed)
    create_gradient_rect(draw, 180, 100, 240, 200, (240, 90, 70), (220, 70, 55))
    # Hot spots
    draw.ellipse([260, 140, 340, 200], fill=(255, 240, 230))
    for i in range(0, 240, 25):
        draw.line([(180 + i, 120), (195 + i, 280)], fill=(255, 248, 240), width=3)
    draw.text((10, 10), "4. Flash Photography", fill=(80, 80, 80))
    images["04_flash"] = img

    # 5. Red meat closeup — rich reds and whites
    img = Image.new("RGB", IMG_SIZE, (60, 25, 20))
    draw = ImageDraw.Draw(img)
    # Large meat surface
    create_gradient_rect(draw, 0, 0, 600, 400, (170, 40, 30), (130, 25, 18))
    # Marbling detail
    for i in range(0, 600, 15):
        offset = int(math.sin(i * 0.05) * 20)
        draw.line([(i, 50 + offset), (i + 10, 350 + offset)], fill=(220, 200, 180), width=4)
    # Fat cap
    create_gradient_rect(draw, 0, 0, 600, 60, (230, 215, 195), (200, 180, 160))
    # Char marks
    for y in range(0, 400, 80):
        draw.line([(0, y), (600, y + 30)], fill=(50, 20, 10), width=6)
    draw.text((10, 10), "5. Red Meat Closeup", fill=(220, 180, 160))
    images["05_meat_closeup"] = img

    return images


def create_comparison(before, after, label):
    """Create side-by-side Before/After comparison."""
    w, h = before.size
    comp = Image.new("RGB", (w * 2 + 4, h + 30), (26, 26, 26))
    comp.paste(before, (0, 30))
    comp.paste(after, (w + 4, 30))

    draw = ImageDraw.Draw(comp)
    draw.text((10, 5), f"BEFORE", fill=(180, 180, 180))
    draw.text((w + 14, 5), f"AFTER — WAGYU SAMURAI LUT", fill=(196, 163, 90))
    # Center divider
    draw.line([(w, 30), (w, h + 30)], fill=(196, 163, 90), width=2)
    draw.line([(w + 2, 30), (w + 2, h + 30)], fill=(196, 163, 90), width=2)

    return comp


def main():
    print("Parsing LUT...")
    size, data = parse_cube_lut(LUT_PATH)
    print(f"LUT loaded: {size}x{size}x{size}")

    print("Generating test images...")
    images = generate_test_images()

    os.makedirs(SAMPLES_DIR, exist_ok=True)

    for name, img in images.items():
        # Save original
        orig_path = os.path.join(SAMPLES_DIR, f"{name}_before.jpg")
        img.save(orig_path, "JPEG", quality=90)
        print(f"  Saved {orig_path}")

        # Apply LUT
        print(f"  Applying LUT to {name}...")
        processed = apply_lut_to_image(img, size, data)
        proc_path = os.path.join(SAMPLES_DIR, f"{name}_after.jpg")
        processed.save(proc_path, "JPEG", quality=90)
        print(f"  Saved {proc_path}")

        # Create comparison
        comp = create_comparison(img, processed, name)
        comp_path = os.path.join(SAMPLES_DIR, f"{name}_comparison.jpg")
        comp.save(comp_path, "JPEG", quality=90)
        print(f"  Saved {comp_path}")

    print(f"\nDone! All images saved to {SAMPLES_DIR}")


if __name__ == "__main__":
    main()
