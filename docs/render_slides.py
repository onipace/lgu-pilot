"""
Render styled slide images for PILLAR demo video.
Creates 1920x1080 PNG images for slides that need custom rendering.
"""
from PIL import Image, ImageDraw, ImageFont
import os

BASE = r"C:\Users\Emil V. Capino\DATA\QWork\PILLAR\docs\screenshots"
W, H = 1920, 1080

# Colors
NAVY = (10, 15, 30)
DARK_NAVY = (6, 10, 22)
WHITE = (255, 255, 255)
LIGHT_GRAY = (200, 200, 200)
ACCENT_BLUE = (0, 158, 219)
ACCENT_GOLD = (255, 184, 28)
ACCENT_GREEN = (0, 200, 83)


def get_font(size, bold=False):
    """Get a font at the specified size."""
    # Try common Windows fonts
    font_paths = [
        r"C:\Windows\Fonts\calibrib.ttf" if bold else r"C:\Windows\Fonts\calibri.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            return ImageFont.truetype(fp, size)
    return ImageFont.load_default()


def draw_text_centered(draw, text, y, font, fill):
    """Draw centered text."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (W - tw) // 2
    draw.text((x, y), text, font=font, fill=fill)


def draw_line(draw, x1, y, x2, color, thickness=3):
    """Draw a horizontal line."""
    draw.rectangle([x1, y, x2, y + thickness], fill=color)


def render_title_slide():
    """Slide 1: Title slide."""
    img = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(img)

    # Accent line
    draw_line(draw, 400, 300, 900, ACCENT_BLUE, 4)

    # Title
    font_title = get_font(72, bold=True)
    draw_text_centered(draw, "PILLAR", 330, font_title, WHITE)

    # Subtitle
    font_sub = get_font(38)
    draw_text_centered(draw, "Smart Legislation Platform", 430, font_sub, ACCENT_BLUE)

    # Tagline
    font_tag = get_font(26)
    draw_text_centered(draw, "From Paper Archives to Codified Law", 510, font_tag, LIGHT_GRAY)

    # Team
    font_team = get_font(22)
    draw_text_centered(draw, "Emil V. Capino  |  BayanAIhan", 620, font_team, LIGHT_GRAY)
    draw_text_centered(draw, "pillar.bayanaihan.net", 660, font_team, ACCENT_BLUE)

    img.save(os.path.join(BASE, "slide-01-title.png"))
    print("  slide-01-title.png")


def render_problem_slide():
    """Slide 2: The Problem."""
    img = Image.new("RGB", (W, H), DARK_NAVY)
    draw = ImageDraw.Draw(img)

    # Label
    font_label = get_font(20, bold=True)
    draw.text((150, 100), "THE PROBLEM", font=font_label, fill=ACCENT_GOLD)

    # Accent line
    draw_line(draw, 150, 150, 400, ACCENT_GOLD, 3)

    # Main statement
    font_main = get_font(52, bold=True)
    draw.text((150, 200), "349 Ordinances. 35 Years.", font=font_main, fill=WHITE)
    draw.text((150, 270), "Zero Digitized.", font=font_main, fill=WHITE)

    # Bullet points
    font_bullet = get_font(26)
    bullets = [
        "  \u2022  Decades of legislation locked in filing cabinets \u2014 no search, no index",
        "  \u2022  No way to detect contradictions between old and new ordinances",
        "  \u2022  DILG compliance requires digitized, classified archives",
    ]
    y = 420
    for b in bullets:
        draw.text((150, y), b, font=font_bullet, fill=LIGHT_GRAY)
        y += 60

    img.save(os.path.join(BASE, "slide-02-problem.png"))
    print("  slide-02-problem.png")


def render_results_slide():
    """Slide 9: Results."""
    img = Image.new("RGB", (W, H), DARK_NAVY)
    draw = ImageDraw.Draw(img)

    # Label
    font_label = get_font(20, bold=True)
    draw.text((150, 100), "RESULTS", font=font_label, fill=ACCENT_GREEN)

    # Accent line
    draw_line(draw, 150, 150, 400, ACCENT_GREEN, 3)

    # Main statement
    font_main = get_font(52, bold=True)
    draw.text((150, 200), "97.6% UAT Pass Rate.", font=font_main, fill=WHITE)
    draw.text((150, 270), "GO Verdict.", font=font_main, fill=WHITE)

    # Metrics
    font_metric = get_font(64, bold=True)
    font_metric_label = get_font(22)

    metrics = [
        ("14s", "Avg. OCR Processing", ACCENT_BLUE, 250),
        ("100%", "Cross-Reference Precision", ACCENT_GREEN, 750),
        ("<1ms", "Full-Text Search", ACCENT_GOLD, 1250),
    ]

    for value, label, color, x in metrics:
        bbox = draw.textbbox((0, 0), value, font=font_metric)
        tw = bbox[2] - bbox[0]
        draw.text((x - tw // 2, 430), value, font=font_metric, fill=color)

        bbox2 = draw.textbbox((0, 0), label, font=font_metric_label)
        tw2 = bbox2[2] - bbox2[0]
        draw.text((x - tw2 // 2, 520), label, font=font_metric_label, fill=LIGHT_GRAY)

    # Bottom stats
    font_stat = get_font(20)
    stat_text = "349 ordinances digitized  \u2022  35 years of legislation indexed  \u2022  0 defects in production"
    draw_text_centered(draw, stat_text, 650, font_stat, LIGHT_GRAY)

    img.save(os.path.join(BASE, "slide-09-results.png"))
    print("  slide-09-results.png")


def render_cta_slide():
    """Slide 10: Call to Action."""
    img = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(img)

    # Accent line
    draw_line(draw, 400, 260, 1520, ACCENT_BLUE, 4)

    # Title
    font_title = get_font(64, bold=True)
    draw_text_centered(draw, "Try It Live", 300, font_title, WHITE)

    # URL
    font_url = get_font(42)
    draw_text_centered(draw, "pillar.bayanaihan.net", 410, font_url, ACCENT_BLUE)

    # QR placeholder
    qr_size = 180
    qr_x = (W - qr_size) // 2
    qr_y = 510
    draw.rectangle([qr_x, qr_y, qr_x + qr_size, qr_y + qr_size], fill=WHITE)
    font_qr = get_font(20)
    draw_text_centered(draw, "QR CODE", 580, font_qr, NAVY)

    # Tagline
    font_tag = get_font(22)
    draw_text_centered(draw, "From paper to codified law, one ordinance at a time", 740, font_tag, LIGHT_GRAY)

    img.save(os.path.join(BASE, "slide-10-cta.png"))
    print("  slide-10-cta.png")


if __name__ == "__main__":
    print("Rendering styled slide images...")
    render_title_slide()
    render_problem_slide()
    render_results_slide()
    render_cta_slide()
    print("Done! All styled slides rendered.")
