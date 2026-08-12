"""
PILLAR Demo Deck Generator
Creates a 10-slide PPTX presentation with embedded screenshots.
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# Paths
BASE = r"C:\Users\Emil V. Capino\DATA\QWork\PILLAR"
SCREENSHOTS = os.path.join(BASE, "docs", "screenshots")
OUTPUT = os.path.join(BASE, "docs", "DEMO-DECK.pptx")

# Colors
NAVY = RGBColor(0x0A, 0x0F, 0x1E)
DARK_NAVY = RGBColor(0x06, 0x0A, 0x16)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY = RGBColor(0xCC, 0xCC, 0xCC)
ACCENT_BLUE = RGBColor(0x00, 0x9E, 0xDB)
ACCENT_GOLD = RGBColor(0xFF, 0xB8, 0x1C)
ACCENT_GREEN = RGBColor(0x00, 0xC8, 0x53)

# Slide dimensions (16:9)
SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)


def set_slide_bg(slide, color):
    """Set solid background color for a slide."""
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_text_box(slide, left, top, width, height, text, font_size=18,
                 bold=False, color=WHITE, alignment=PP_ALIGN.LEFT,
                 font_name="Calibri", line_spacing=1.2):
    """Add a text box with specified formatting."""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.font.name = font_name
    p.alignment = alignment
    p.space_after = Pt(0)
    p.line_spacing = Pt(font_size * line_spacing)
    return txBox


def add_multi_text(slide, left, top, width, height, lines, font_name="Calibri"):
    """Add text box with multiple styled paragraphs.
    lines: list of dicts with keys: text, size, bold, color, alignment, spacing_after
    """
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True

    for i, line in enumerate(lines):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = line.get("text", "")
        p.font.size = Pt(line.get("size", 18))
        p.font.bold = line.get("bold", False)
        p.font.color.rgb = line.get("color", WHITE)
        p.font.name = font_name
        p.alignment = line.get("alignment", PP_ALIGN.LEFT)
        p.space_after = Pt(line.get("spacing_after", 6))
        p.line_spacing = Pt(line.get("size", 18) * 1.3)
    return txBox


def add_image_centered(slide, img_path, max_w=Inches(10), max_h=Inches(5.5),
                       center_x=Inches(6.667), center_y=Inches(3.75)):
    """Add image centered on slide, maintaining aspect ratio."""
    from PIL import Image
    img = Image.open(img_path)
    iw, ih = img.size
    aspect = iw / ih

    # Fit within max dimensions
    w = max_w
    h = int(w / aspect)
    if h > max_h:
        h = max_h
        w = int(h * aspect)

    left = int(center_x - w / 2)
    top = int(center_y - h / 2)
    return slide.shapes.add_picture(img_path, left, top, w, h)


def add_caption(slide, text, top=Inches(6.8)):
    """Add a caption bar at the bottom of the slide."""
    # Semi-transparent background bar
    shape = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(0), top, SLIDE_W, Inches(0.7)
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = RGBColor(0x00, 0x00, 0x00)
    shape.line.fill.background()

    add_text_box(slide, Inches(0.5), top + Inches(0.1), Inches(12), Inches(0.5),
                 text, font_size=16, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER,
                 font_name="Calibri")


def add_accent_line(slide, left, top, width, color=ACCENT_BLUE):
    """Add a thin accent line."""
    shape = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, left, top, width, Inches(0.04)
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def create_presentation():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    blank_layout = prs.slide_layouts[6]  # Blank layout

    # =========================================================================
    # SLIDE 1: Title
    # =========================================================================
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, NAVY)

    # Accent line
    add_accent_line(slide, Inches(1.5), Inches(2.4), Inches(3), ACCENT_BLUE)

    # Title
    add_text_box(slide, Inches(1.5), Inches(2.6), Inches(10), Inches(1.2),
                 "PILLAR", font_size=54, bold=True, color=WHITE,
                 font_name="Calibri")

    # Subtitle
    add_text_box(slide, Inches(1.5), Inches(3.7), Inches(10), Inches(0.8),
                 "Smart Legislation Platform", font_size=28, color=ACCENT_BLUE,
                 font_name="Calibri")

    # Tagline
    add_text_box(slide, Inches(1.5), Inches(4.5), Inches(10), Inches(0.6),
                 "From Paper Archives to Codified Law", font_size=20,
                 color=LIGHT_GRAY, font_name="Calibri")

    # Team
    add_multi_text(slide, Inches(1.5), Inches(5.5), Inches(10), Inches(1.2), [
        {"text": "Emil V. Capino  |  BayanAIhan", "size": 16, "color": LIGHT_GRAY},
        {"text": "pillar.bayanaihan.net", "size": 14, "color": ACCENT_BLUE},
    ])

    # =========================================================================
    # SLIDE 2: The Problem
    # =========================================================================
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, DARK_NAVY)

    add_text_box(slide, Inches(1), Inches(0.8), Inches(11), Inches(1),
                 "THE PROBLEM", font_size=16, bold=True, color=ACCENT_GOLD,
                 font_name="Calibri")

    add_accent_line(slide, Inches(1), Inches(1.5), Inches(2), ACCENT_GOLD)

    add_text_box(slide, Inches(1), Inches(1.8), Inches(11), Inches(1.5),
                 "349 Ordinances. 35 Years.\nZero Digitized.",
                 font_size=40, bold=True, color=WHITE, font_name="Calibri")

    add_multi_text(slide, Inches(1), Inches(3.8), Inches(10), Inches(3), [
        {"text": "  \u2022  Decades of legislation locked in filing cabinets \u2014 no search, no index",
         "size": 20, "color": LIGHT_GRAY, "spacing_after": 16},
        {"text": "  \u2022  No way to detect contradictions between old and new ordinances",
         "size": 20, "color": LIGHT_GRAY, "spacing_after": 16},
        {"text": "  \u2022  DILG compliance requires digitized, classified archives",
         "size": 20, "color": LIGHT_GRAY, "spacing_after": 16},
    ])

    # =========================================================================
    # SLIDE 3: LIKHA \u2014 Digitization
    # =========================================================================
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, NAVY)

    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(5), Inches(0.5),
                 "LIKHA \u2014 Digitization", font_size=22, bold=True,
                 color=ACCENT_BLUE, font_name="Calibri")

    img_path = os.path.join(SCREENSHOTS, "showcase-01-likha-home.png")
    add_image_centered(slide, img_path, max_w=Inches(11), max_h=Inches(5.5),
                       center_y=Inches(3.5))

    add_caption(slide, "Upload, OCR, classify \u2014 with mandatory human review")

    # =========================================================================
    # SLIDE 4: LIKHA \u2014 HITL Review
    # =========================================================================
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, NAVY)

    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(5), Inches(0.5),
                 "LIKHA \u2014 Human-in-the-Loop Review", font_size=22,
                 bold=True, color=ACCENT_BLUE, font_name="Calibri")

    img_path = os.path.join(SCREENSHOTS, "showcase-04-likha-hitl.png")
    add_image_centered(slide, img_path, max_w=Inches(11), max_h=Inches(5.5),
                       center_y=Inches(3.5))

    add_caption(slide, "Every legal decision requires human approval")

    # =========================================================================
    # SLIDE 5: LIKHA \u2014 Published Archive
    # =========================================================================
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, NAVY)

    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(5), Inches(0.5),
                 "LIKHA \u2014 Published Archive", font_size=22, bold=True,
                 color=ACCENT_BLUE, font_name="Calibri")

    img_path = os.path.join(SCREENSHOTS, "showcase-05-likha-published.png")
    add_image_centered(slide, img_path, max_w=Inches(11), max_h=Inches(5.5),
                       center_y=Inches(3.5))

    add_caption(slide, "Searchable, classified, DILG-compliant archive")

    # =========================================================================
    # SLIDE 6: LINAW \u2014 Codification
    # =========================================================================
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, NAVY)

    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(5), Inches(0.5),
                 "LINAW \u2014 Codification Engine", font_size=22, bold=True,
                 color=ACCENT_GREEN, font_name="Calibri")

    img_path = os.path.join(SCREENSHOTS, "showcase-06-linaw-home.png")
    add_image_centered(slide, img_path, max_w=Inches(11), max_h=Inches(5.5),
                       center_y=Inches(3.5))

    add_caption(slide, "Import, classify, cross-reference, assemble")

    # =========================================================================
    # SLIDE 7: LINAW \u2014 Conflict Detection
    # =========================================================================
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, NAVY)

    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(5), Inches(0.5),
                 "LINAW \u2014 Conflict Detection", font_size=22, bold=True,
                 color=ACCENT_GREEN, font_name="Calibri")

    img_path = os.path.join(SCREENSHOTS, "showcase-08-linaw-conflict.png")
    add_image_centered(slide, img_path, max_w=Inches(11), max_h=Inches(5.5),
                       center_y=Inches(3.5))

    add_caption(slide, "AI detects contradictions, humans decide")

    # =========================================================================
    # SLIDE 8: LINAW \u2014 Code Assembly
    # =========================================================================
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, NAVY)

    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(5), Inches(0.5),
                 "LINAW \u2014 Code Assembly", font_size=22, bold=True,
                 color=ACCENT_GREEN, font_name="Calibri")

    img_path = os.path.join(SCREENSHOTS, "showcase-09-linaw-assembly.png")
    add_image_centered(slide, img_path, max_w=Inches(11), max_h=Inches(5.5),
                       center_y=Inches(3.5))

    add_caption(slide, "Ordinances \u2192 codified volumes, automatically")

    # =========================================================================
    # SLIDE 9: Results
    # =========================================================================
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, DARK_NAVY)

    add_text_box(slide, Inches(1), Inches(0.8), Inches(11), Inches(1),
                 "RESULTS", font_size=16, bold=True, color=ACCENT_GREEN,
                 font_name="Calibri")

    add_accent_line(slide, Inches(1), Inches(1.5), Inches(2), ACCENT_GREEN)

    add_text_box(slide, Inches(1), Inches(1.8), Inches(11), Inches(1.2),
                 "97.6% UAT Pass Rate.\nGO Verdict.",
                 font_size=40, bold=True, color=WHITE, font_name="Calibri")

    # Metrics in 3 columns
    metrics = [
        ("14s", "Avg. OCR\nProcessing", ACCENT_BLUE),
        ("100%", "Cross-Reference\nPrecision", ACCENT_GREEN),
        ("<1ms", "Full-Text\nSearch", ACCENT_GOLD),
    ]

    for i, (value, label, color) in enumerate(metrics):
        x = Inches(1.5 + i * 3.8)
        add_text_box(slide, x, Inches(3.5), Inches(3), Inches(1),
                     value, font_size=48, bold=True, color=color,
                     alignment=PP_ALIGN.CENTER, font_name="Calibri")
        add_text_box(slide, x, Inches(4.6), Inches(3), Inches(1),
                     label, font_size=16, color=LIGHT_GRAY,
                     alignment=PP_ALIGN.CENTER, font_name="Calibri")

    # Additional stats
    add_multi_text(slide, Inches(1), Inches(5.8), Inches(11), Inches(1.5), [
        {"text": "349 ordinances digitized  \u2022  35 years of legislation indexed  \u2022  0 defects in production",
         "size": 16, "color": LIGHT_GRAY, "alignment": PP_ALIGN.CENTER},
    ])

    # =========================================================================
    # SLIDE 10: Call to Action
    # =========================================================================
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, NAVY)

    add_accent_line(slide, Inches(3), Inches(2.2), Inches(7), ACCENT_BLUE)

    add_text_box(slide, Inches(1), Inches(2.5), Inches(11), Inches(1.2),
                 "Try It Live", font_size=48, bold=True, color=WHITE,
                 alignment=PP_ALIGN.CENTER, font_name="Calibri")

    add_text_box(slide, Inches(1), Inches(3.8), Inches(11), Inches(0.8),
                 "pillar.bayanaihan.net", font_size=32, color=ACCENT_BLUE,
                 alignment=PP_ALIGN.CENTER, font_name="Calibri")

    # QR code placeholder
    qr_shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Inches(5.5), Inches(4.8), Inches(2), Inches(2)
    )
    qr_shape.fill.solid()
    qr_shape.fill.fore_color.rgb = WHITE
    qr_shape.line.fill.background()
    tf = qr_shape.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "QR\nCODE"
    p.font.size = Pt(14)
    p.font.color.rgb = NAVY
    p.alignment = PP_ALIGN.CENTER

    add_text_box(slide, Inches(1), Inches(7.0), Inches(11), Inches(0.5),
                 "From paper to codified law, one ordinance at a time",
                 font_size=16, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER,
                 font_name="Calibri")

    # Save
    prs.save(OUTPUT)
    print(f"Saved: {OUTPUT}")
    return OUTPUT


if __name__ == "__main__":
    create_presentation()
