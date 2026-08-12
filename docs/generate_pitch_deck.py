"""
PILLAR Pitch Deck Generator — Dark theme with amber/emerald/violet accents.
5 slides following AIDA framework.
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_AUTO_SIZE, PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn
import os


# ---------- Dark theme palette ----------
PALETTE = {
    "bg":       RGBColor(0x0A, 0x0F, 0x1E),  # navy background
    "white":    RGBColor(0xFF, 0xFF, 0xFF),
    "amber":    RGBColor(0xF5, 0x9E, 0x0B),  # accent 1
    "emerald":  RGBColor(0x10, 0xB9, 0x81),  # accent 2
    "violet":   RGBColor(0x8B, 0x5C, 0xF6),  # accent 3
    "muted":    RGBColor(0x94, 0xA3, 0xB8),  # slate-400
    "card":     RGBColor(0x14, 0x1B, 0x2D),  # slightly lighter card bg
    "card_border": RGBColor(0x1E, 0x29, 0x3B),  # subtle border
}

FONT_HEAD = "Calibri"
FONT_BODY = "Calibri"
FONT_HEAD_EA = "Microsoft YaHei"
FONT_BODY_EA = "Microsoft YaHei"

# Character budgets
CHAR_BUDGET = {
    "cover_title":   60,
    "cover_subtitle": 100,
    "slide_title":   55,
    "section_head":  40,
    "body_line":     120,
    "stat_number":   20,
    "stat_label":    30,
    "footer":        80,
}


def guard(text, key):
    limit = CHAR_BUDGET[key]
    if len(text) <= limit:
        return text
    cut = text[:limit - 1]
    sp = cut.rfind(" ")
    return (cut[:sp] if sp > 0 else cut) + "\u2026"


def set_fonts(run, latin, ea):
    run.font.name = latin
    rPr = run._r.get_or_add_rPr()
    ea_el = rPr.find(qn("a:ea"))
    if ea_el is None:
        ea_el = rPr.makeelement(qn("a:ea"), {"typeface": ea})
        rPr.append(ea_el)
    else:
        ea_el.set("typeface", ea)


def add_text(slide, text, x, y, w, h, *,
             size=14, bold=False, color=None, align=PP_ALIGN.LEFT,
             font=None, font_ea=None, budget_key=None):
    if budget_key:
        text = guard(text, budget_key)
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = Inches(0.05)
    tf.margin_right = Inches(0.05)
    tf.margin_top = Inches(0.02)
    tf.margin_bottom = Inches(0.02)
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = text
    r.font.name = font or FONT_BODY
    r.font.size = Pt(size)
    r.font.bold = bold
    if color is not None:
        r.font.color.rgb = color
    set_fonts(r, font or FONT_BODY, font_ea or FONT_BODY_EA)
    return tb


def add_rect(slide, x, y, w, h, fill, line=None):
    shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,
                                 Inches(x), Inches(y), Inches(w), Inches(h))
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
    shp.shadow.inherit = False
    return shp


def add_rounded_rect(slide, x, y, w, h, fill, line=None):
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,
                                 Inches(x), Inches(y), Inches(w), Inches(h))
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
    shp.shadow.inherit = False
    return shp


def fill_bg(slide):
    """Fill entire slide with dark background."""
    add_rect(slide, 0, 0, 13.333, 7.5, PALETTE["bg"])


def add_accent_bar(slide, x, y, w, h, color):
    """Thin accent bar as visual motif."""
    add_rect(slide, x, y, w, h, color)


def save_pptx(prs, path):
    """Save PPTX and strip template thumbnail."""
    prs.save(path)
    import zipfile as _zf
    import re as _re
    tmp = path + ".tmp"
    try:
        with _zf.ZipFile(path, "r") as zin, _zf.ZipFile(tmp, "w") as zout:
            for item in zin.infolist():
                if item.filename.lower().startswith("docprops/thumbnail"):
                    continue
                data = zin.read(item.filename)
                if item.filename == "[Content_Types].xml":
                    content = data.decode("utf-8")
                    content = _re.sub(
                        r'<Override[^>]*PartName="/docProps/thumbnail[^"]*"[^>]*/?>',
                        '', content, flags=_re.IGNORECASE
                    )
                    data = content.encode("utf-8")
                if item.filename == "_rels/.rels":
                    content = data.decode("utf-8")
                    content = _re.sub(
                        r'<Relationship[^>]*Target="docProps/thumbnail[^"]*"[^>]*/?>',
                        '', content, flags=_re.IGNORECASE
                    )
                    data = content.encode("utf-8")
                zout.writestr(item, data)
        os.replace(tmp, path)
    except Exception as e:
        print("warning: failed to strip thumbnail:", e)
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass


# ---------- SLIDE BUILDERS ----------

def build_slide1_cover(prs):
    """Slide 1: INTRODUCTION (Attention) — 15s"""
    s = prs.slides.add_slide(prs.slide_layouts[6])
    fill_bg(s)

    # Top accent bar — amber
    add_accent_bar(s, 0, 0, 13.333, 0.06, PALETTE["amber"])

    # Main headline
    add_text(s, "Paper Archives to Codified Law", 1.0, 2.2, 11.3, 1.4,
             size=48, bold=True, color=PALETTE["white"],
             align=PP_ALIGN.CENTER, font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="cover_title")

    # Sub-headline
    add_text(s, "PILLAR turns 35 years of unsearchable ordinances into a\nsearchable, codified digital archive \u2014 in minutes, not months.",
             1.5, 3.8, 10.3, 1.2,
             size=18, color=PALETTE["muted"],
             align=PP_ALIGN.CENTER, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="cover_subtitle")

    # Team info
    add_text(s, "Emil V. Capino  |  BayanAIhan", 1.0, 5.6, 11.3, 0.5,
             size=16, color=PALETTE["amber"],
             align=PP_ALIGN.CENTER, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="footer")

    # Live URL
    add_text(s, "pillar.bayanaihan.net", 1.0, 6.2, 11.3, 0.4,
             size=13, color=PALETTE["emerald"],
             align=PP_ALIGN.CENTER, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="footer")

    # Bottom accent bar — violet
    add_accent_bar(s, 0, 7.44, 13.333, 0.06, PALETTE["violet"])
    return s


def build_slide2_problem(prs):
    """Slide 2: THE PROBLEM (Interest/PAS) — 30s"""
    s = prs.slides.add_slide(prs.slide_layouts[6])
    fill_bg(s)

    # Left accent bar — amber
    add_accent_bar(s, 0, 0, 0.12, 7.5, PALETTE["amber"])

    # Title
    add_text(s, "349 Ordinances. Zero Digitized.", 0.6, 0.5, 12.1, 0.9,
             size=34, bold=True, color=PALETTE["white"],
             font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="slide_title")

    # Big stat callout
    add_text(s, "349", 0.6, 1.8, 4.0, 2.2,
             size=120, bold=True, color=PALETTE["amber"],
             align=PP_ALIGN.CENTER, font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="stat_number")
    add_text(s, "ordinances spanning 35 years", 0.6, 4.0, 4.0, 0.5,
             size=16, color=PALETTE["muted"],
             align=PP_ALIGN.CENTER, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="stat_label")

    # Pain points — right side
    pain_points = [
        ("No search", "Maria flips through physical binders for hours to find one ordinance."),
        ("No cross-references", "Conflicting ordinances go undetected until DILG audits."),
        ("No codification", "Assembling code volumes takes weeks of manual compilation."),
        ("Compliance risk", "DILG MC 2026-041 mandates digitization. Manual processes fail."),
    ]

    y = 1.8
    for title, desc in pain_points:
        # Bullet marker
        add_rect(s, 5.2, y + 0.08, 0.08, 0.08, PALETTE["amber"])
        add_text(s, title, 5.5, y - 0.05, 7.0, 0.4,
                 size=16, bold=True, color=PALETTE["white"],
                 font=FONT_HEAD, font_ea=FONT_HEAD_EA,
                 budget_key="section_head")
        add_text(s, desc, 5.5, y + 0.35, 7.2, 0.6,
                 size=13, color=PALETTE["muted"],
                 font=FONT_BODY, font_ea=FONT_BODY_EA,
                 budget_key="body_line")
        y += 1.15

    # Who suffers footer
    add_text(s, "Who suffers: Maria the SB Secretary  \u2022  DILG compliance officers  \u2022  Municipal lawyers",
             0.6, 6.8, 12.1, 0.4,
             size=11, color=PALETTE["muted"],
             align=PP_ALIGN.LEFT, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="footer")
    return s


def build_slide3_solution(prs):
    """Slide 3: OUR SOLUTION (Desire) — 30s"""
    s = prs.slides.add_slide(prs.slide_layouts[6])
    fill_bg(s)

    # Left accent bar — emerald
    add_accent_bar(s, 0, 0, 0.12, 7.5, PALETTE["emerald"])

    # Title
    add_text(s, "Two Modules. One Platform.", 0.6, 0.5, 12.1, 0.9,
             size=34, bold=True, color=PALETTE["white"],
             font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="slide_title")

    # LIKHA card
    add_rounded_rect(s, 0.6, 1.8, 5.8, 3.6, PALETTE["card"], PALETTE["card_border"])
    add_text(s, "LIKHA", 0.9, 2.0, 5.2, 0.5,
             size=24, bold=True, color=PALETTE["amber"],
             font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="section_head")
    add_text(s, "Digitizes, OCRs, classifies, and publishes ordinances.",
             0.9, 2.6, 5.2, 0.7,
             size=14, color=PALETTE["white"],
             font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="body_line")
    add_text(s, "\u2022 Batch upload with AI OCR\n\u2022 Auto metadata extraction\n\u2022 Subject classification\n\u2022 Mandatory HITL before publish",
             0.9, 3.4, 5.2, 1.8,
             size=13, color=PALETTE["muted"],
             font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="body_line")

    # LINAW card
    add_rounded_rect(s, 6.9, 1.8, 5.8, 3.6, PALETTE["card"], PALETTE["card_border"])
    add_text(s, "LINAW", 7.2, 2.0, 5.2, 0.5,
             size=24, bold=True, color=PALETTE["emerald"],
             font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="section_head")
    add_text(s, "Imports, cross-references, detects conflicts, and assembles codified volumes.",
             7.2, 2.6, 5.2, 0.7,
             size=14, color=PALETTE["white"],
             font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="body_line")
    add_text(s, "\u2022 Cross-reference detection\n\u2022 Conflict flagging with scores\n\u2022 Code volume assembly\n\u2022 BM25 search in <1ms",
             7.2, 3.4, 5.2, 1.8,
             size=13, color=PALETTE["muted"],
             font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="body_line")

    # Social proof bar
    add_rounded_rect(s, 0.6, 5.8, 12.1, 1.0, PALETTE["card"], PALETTE["card_border"])

    # UAT stat
    add_text(s, "97.6%", 1.0, 5.9, 2.5, 0.5,
             size=28, bold=True, color=PALETTE["emerald"],
             align=PP_ALIGN.CENTER, font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="stat_number")
    add_text(s, "UAT Pass Rate  \u2022  GO Verdict", 1.0, 6.4, 2.5, 0.3,
             size=11, color=PALETTE["muted"],
             align=PP_ALIGN.CENTER, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="stat_label")

    # Build time stat
    add_text(s, "~24 hrs", 5.0, 5.9, 3.0, 0.5,
             size=28, bold=True, color=PALETTE["violet"],
             align=PP_ALIGN.CENTER, font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="stat_number")
    add_text(s, "Built in ~24 Hours", 5.0, 6.4, 3.0, 0.3,
             size=11, color=PALETTE["muted"],
             align=PP_ALIGN.CENTER, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="stat_label")

    # URL
    add_text(s, "pillar.bayanaihan.net", 9.5, 6.0, 3.0, 0.5,
             size=14, color=PALETTE["emerald"],
             align=PP_ALIGN.CENTER, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="footer")
    return s


def build_slide4_features(prs):
    """Slide 4: KEY FEATURES (Desire deepened) — 45s"""
    s = prs.slides.add_slide(prs.slide_layouts[6])
    fill_bg(s)

    # Left accent bar — violet
    add_accent_bar(s, 0, 0, 0.12, 7.5, PALETTE["violet"])

    # Title
    add_text(s, "Built for Legislative Workflows", 0.6, 0.5, 12.1, 0.9,
             size=34, bold=True, color=PALETTE["white"],
             font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="slide_title")

    # Feature 1 card
    add_rounded_rect(s, 0.6, 1.8, 3.8, 3.8, PALETTE["card"], PALETTE["card_border"])
    add_text(s, "Batch Upload + AI OCR", 0.9, 2.0, 3.2, 0.5,
             size=16, bold=True, color=PALETTE["amber"],
             font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="section_head")
    add_text(s, "10 files in\nunder 2 min", 0.9, 2.7, 3.2, 1.2,
             size=32, bold=True, color=PALETTE["white"],
             align=PP_ALIGN.CENTER, font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="cover_title")
    add_text(s, "14s OCR latency per document.\nMetadata extraction and classification happen automatically.",
             0.9, 4.2, 3.2, 1.0,
             size=12, color=PALETTE["muted"],
             font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="body_line")

    # Feature 2 card
    add_rounded_rect(s, 4.75, 1.8, 3.8, 3.8, PALETTE["card"], PALETTE["card_border"])
    add_text(s, "Cross-Reference Detection", 5.05, 2.0, 3.2, 0.5,
             size=16, bold=True, color=PALETTE["emerald"],
             font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="section_head")
    add_text(s, "100%\nprecision", 5.05, 2.7, 3.2, 1.2,
             size=32, bold=True, color=PALETTE["white"],
             align=PP_ALIGN.CENTER, font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="cover_title")
    add_text(s, "Zero false positives on test fixtures.\nConflicts flagged with confidence scores.",
             5.05, 4.2, 3.2, 1.0,
             size=12, color=PALETTE["muted"],
             font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="body_line")

    # Feature 3 card
    add_rounded_rect(s, 8.9, 1.8, 3.8, 3.8, PALETTE["card"], PALETTE["card_border"])
    add_text(s, "Code Assembly", 9.2, 2.0, 3.2, 0.5,
             size=16, bold=True, color=PALETTE["violet"],
             font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="section_head")
    add_text(s, "<1ms\nsearch", 9.2, 2.7, 3.2, 1.2,
             size=32, bold=True, color=PALETTE["white"],
             align=PP_ALIGN.CENTER, font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="cover_title")
    add_text(s, "Ordinances to codified volumes automatically.\nBM25 search across full corpus.",
             9.2, 4.2, 3.2, 1.0,
             size=12, color=PALETTE["muted"],
             font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="body_line")

    # HITL callout bar
    add_rounded_rect(s, 0.6, 6.0, 12.1, 0.9, PALETTE["card"], PALETTE["amber"])
    add_text(s, "Mandatory HITL: Every legal decision point requires human approval. The AI suggests. A human decides.",
             0.9, 6.1, 11.5, 0.7,
             size=14, bold=True, color=PALETTE["amber"],
             align=PP_ALIGN.CENTER, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="body_line")
    return s


def build_slide5_cta(prs):
    """Slide 5: LIVE DEMO + CTA (Action) — 30s"""
    s = prs.slides.add_slide(prs.slide_layouts[6])
    fill_bg(s)

    # Top accent bar — emerald
    add_accent_bar(s, 0, 0, 13.333, 0.06, PALETTE["emerald"])

    # Headline
    add_text(s, "Try It Yourself", 1.0, 1.5, 11.3, 1.0,
             size=44, bold=True, color=PALETTE["white"],
             align=PP_ALIGN.CENTER, font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="cover_title")

    # URL prominent
    add_text(s, "pillar.bayanaihan.net", 1.0, 3.0, 11.3, 0.8,
             size=28, bold=True, color=PALETTE["emerald"],
             align=PP_ALIGN.CENTER, font=FONT_HEAD, font_ea=FONT_HEAD_EA,
             budget_key="slide_title")

    # QR placeholder box
    add_rounded_rect(s, 5.4, 4.0, 2.5, 2.5, PALETTE["card"], PALETTE["card_border"])
    add_text(s, "[QR Code]", 5.4, 4.8, 2.5, 0.5,
             size=14, color=PALETTE["muted"],
             align=PP_ALIGN.CENTER, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="stat_label")
    add_text(s, "Scan to try", 5.4, 5.3, 2.5, 0.4,
             size=11, color=PALETTE["muted"],
             align=PP_ALIGN.CENTER, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="stat_label")

    # Tagline
    add_text(s, "From paper to codified law, one ordinance at a time.",
             1.0, 6.6, 11.3, 0.5,
             size=16, color=PALETTE["muted"],
             align=PP_ALIGN.CENTER, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="cover_subtitle")

    # Reciprocity
    add_text(s, "Free to try  \u2022  No installation  \u2022  No commitment",
             1.0, 7.0, 11.3, 0.3,
             size=12, color=PALETTE["amber"],
             align=PP_ALIGN.CENTER, font=FONT_BODY, font_ea=FONT_BODY_EA,
             budget_key="footer")

    # Bottom accent bar — amber
    add_accent_bar(s, 0, 7.44, 13.333, 0.06, PALETTE["amber"])
    return s


# ---------- MAIN ----------
def main():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    build_slide1_cover(prs)
    build_slide2_problem(prs)
    build_slide3_solution(prs)
    build_slide4_features(prs)
    build_slide5_cta(prs)

    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "PITCH-DECK.pptx")
    save_pptx(prs, out_path)
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
