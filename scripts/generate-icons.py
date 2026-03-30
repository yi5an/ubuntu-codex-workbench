from pathlib import Path

from PIL import Image, ImageDraw


OUTPUT_DIR = Path(__file__).resolve().parent.parent / "build" / "icons"
SIZES = [16, 32, 48, 64, 128, 256, 512]

BACKGROUND = "#0b1220"
PANEL = "#121c30"
ACCENT = "#58d4c3"
ACCENT_DARK = "#2ea896"
TEXT = "#e7f0ff"
MUTED = "#8aa0b8"


def rounded_rectangle(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    pad = int(size * 0.06)
    radius = int(size * 0.22)
    rounded_rectangle(draw, (pad, pad, size - pad, size - pad), radius, BACKGROUND)

    sidebar_width = int(size * 0.18)
    rounded_rectangle(
        draw,
        (pad + 1, pad + 1, pad + sidebar_width, size - pad - 1),
        max(6, int(size * 0.18)),
        ACCENT,
    )

    inner_pad = int(size * 0.14)
    term_left = pad + sidebar_width + int(size * 0.06)
    term_top = inner_pad
    term_right = size - inner_pad
    term_bottom = size - inner_pad
    rounded_rectangle(
        draw,
        (term_left, term_top, term_right, term_bottom),
        max(8, int(size * 0.08)),
        PANEL,
    )

    line_y = term_top + int(size * 0.12)
    line_x = term_left + int(size * 0.1)
    dot = max(2, int(size * 0.018))
    for index, color in enumerate((ACCENT, MUTED, MUTED)):
        cx = line_x + index * int(size * 0.05)
        draw.ellipse((cx, line_y, cx + dot * 2, line_y + dot * 2), fill=color)

    prompt_y = term_top + int(size * 0.31)
    prompt_x = term_left + int(size * 0.12)
    stroke = max(2, int(size * 0.03))
    draw.line(
        (
            prompt_x,
            prompt_y,
            prompt_x + int(size * 0.07),
            prompt_y + int(size * 0.05),
        ),
        fill=ACCENT,
        width=stroke,
    )
    draw.line(
        (
            prompt_x + int(size * 0.07),
            prompt_y + int(size * 0.05),
            prompt_x,
            prompt_y + int(size * 0.1),
        ),
        fill=ACCENT,
        width=stroke,
    )

    cursor_x = prompt_x + int(size * 0.13)
    cursor_y = prompt_y + int(size * 0.025)
    draw.rounded_rectangle(
        (
            cursor_x,
            cursor_y,
            cursor_x + int(size * 0.12),
            cursor_y + max(3, int(size * 0.03)),
        ),
        radius=max(2, int(size * 0.012)),
        fill=TEXT,
    )

    panel_accent_y = term_bottom - int(size * 0.16)
    draw.rounded_rectangle(
        (
            term_left + int(size * 0.1),
            panel_accent_y,
            term_right - int(size * 0.12),
            panel_accent_y + max(4, int(size * 0.04)),
        ),
        radius=max(2, int(size * 0.02)),
        fill=ACCENT_DARK,
    )

    return image


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        draw_icon(size).save(OUTPUT_DIR / f"{size}x{size}.png")

    draw_icon(512).save(OUTPUT_DIR / "icon.png")


if __name__ == "__main__":
    main()
