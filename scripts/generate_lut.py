#!/usr/bin/env python3
"""
Generate WAGYU SAMURAI brand 3D LUT (.cube file)

Brand tone:
- Warm color shift (orange/amber direction)
- Low saturation (0.8x overall, 0.9x for reds to preserve meat color)
- Moody: slightly dark, higher contrast
- Shadows: not pure black, slightly warm deep black
- Highlights: no blow-out, creamy warm highlights

Image: "Dark premium yakiniku counter, binchotan red glow illuminating the meat"
"""

import math
import os

LUT_SIZE = 33  # 33x33x33 = standard for .cube

def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))

def apply_curve(v, shadow_lift=0.0, highlight_pull=0.0, gamma=1.0, contrast=1.0, midpoint=0.5):
    """Apply tone curve with shadow lift and highlight compression."""
    # Shadow lift
    v = v * (1.0 - shadow_lift) + shadow_lift
    # Gamma
    v = pow(clamp(v), gamma)
    # Contrast around midpoint
    v = (v - midpoint) * contrast + midpoint
    # Highlight pull (compress highlights)
    if v > 0.7:
        blend = (v - 0.7) / 0.3
        v = v - blend * highlight_pull
    return clamp(v)

def rgb_to_hsl(r, g, b):
    """Convert RGB [0-1] to HSL [0-360, 0-1, 0-1]."""
    mx = max(r, g, b)
    mn = min(r, g, b)
    l = (mx + mn) / 2.0
    if mx == mn:
        h = s = 0.0
    else:
        d = mx - mn
        s = d / (2.0 - mx - mn) if l > 0.5 else d / (mx + mn)
        if mx == r:
            h = ((g - b) / d + (6 if g < b else 0)) * 60
        elif mx == g:
            h = ((b - r) / d + 2) * 60
        else:
            h = ((r - g) / d + 4) * 60
    return h, s, l

def hsl_to_rgb(h, s, l):
    """Convert HSL back to RGB [0-1]."""
    if s == 0:
        return l, l, l
    def hue2rgb(p, q, t):
        if t < 0: t += 1
        if t > 1: t -= 1
        if t < 1/6: return p + (q - p) * 6 * t
        if t < 1/2: return q
        if t < 2/3: return p + (q - p) * (2/3 - t) * 6
        return p
    q = l * (1 + s) if l < 0.5 else l + s - l * s
    p = 2 * l - q
    r = hue2rgb(p, q, h / 360.0 + 1/3)
    g = hue2rgb(p, q, h / 360.0)
    b = hue2rgb(p, q, h / 360.0 - 1/3)
    return r, g, b

def transform_color(r, g, b):
    """Apply WAGYU SAMURAI brand color grading to a single RGB triplet [0-1]."""

    # --- 1. Warm color temperature shift ---
    # Boost reds, slightly reduce blues (simulating ~6800K warm shift)
    r = r * 1.06
    g = g * 1.00
    b = b * 0.90

    # --- 2. Apply tone curves per channel ---
    # Red: gentle S-curve, shadow lift with warm tint
    r = apply_curve(r, shadow_lift=0.03, highlight_pull=0.08, gamma=0.97, contrast=1.12, midpoint=0.5)
    # Green: slightly darker, more contrast
    g = apply_curve(g, shadow_lift=0.015, highlight_pull=0.10, gamma=1.02, contrast=1.15, midpoint=0.5)
    # Blue: suppress more, especially in shadows (warm shadows)
    b = apply_curve(b, shadow_lift=0.005, highlight_pull=0.12, gamma=1.08, contrast=1.10, midpoint=0.5)

    r, g, b = clamp(r), clamp(g), clamp(b)

    # --- 3. Selective saturation ---
    h, s, l = rgb_to_hsl(r, g, b)

    # Reduce saturation overall, but preserve reds (meat color)
    if 340 <= h or h <= 30:
        # Red/orange range — preserve meat color (0.92x)
        s *= 0.92
    elif 30 < h <= 60:
        # Orange/yellow range — slight reduction (0.85x)
        s *= 0.85
    else:
        # Everything else — stronger reduction (0.78x)
        s *= 0.78

    r, g, b = hsl_to_rgb(h, s, l)

    # --- 4. Subtle brightness reduction (moody) ---
    darken = 0.97
    r *= darken
    g *= darken
    b *= darken

    # --- 5. Cross-process: add slight warmth to shadows ---
    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if luminance < 0.3:
        shadow_blend = (0.3 - luminance) / 0.3
        # Add amber to shadows
        r += shadow_blend * 0.025
        g += shadow_blend * 0.008
        b -= shadow_blend * 0.015

    # --- 6. Highlight warmth (cream, not cold white) ---
    if luminance > 0.75:
        hi_blend = (luminance - 0.75) / 0.25
        r += hi_blend * 0.015
        g += hi_blend * 0.005
        b -= hi_blend * 0.02

    return clamp(r), clamp(g), clamp(b)


def generate_cube_lut(output_path, size=LUT_SIZE):
    """Generate a .cube LUT file."""
    lines = []
    lines.append(f'TITLE "WAGYU SAMURAI Brand LUT"')
    lines.append(f"LUT_3D_SIZE {size}")
    lines.append(f"DOMAIN_MIN 0.0 0.0 0.0")
    lines.append(f"DOMAIN_MAX 1.0 1.0 1.0")
    lines.append("")

    total = size * size * size
    count = 0

    for bi in range(size):
        for gi in range(size):
            for ri in range(size):
                r_in = ri / (size - 1)
                g_in = gi / (size - 1)
                b_in = bi / (size - 1)

                r_out, g_out, b_out = transform_color(r_in, g_in, b_in)

                lines.append(f"{r_out:.6f} {g_out:.6f} {b_out:.6f}")
                count += 1

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Generated {output_path} ({size}x{size}x{size} = {total} entries)")


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    output = os.path.join(project_dir, "public", "assets", "lut", "wagyu_samurai.cube")
    generate_cube_lut(output)
