"""
PILLAR Documentation PDF Generator
Converts the comprehensive Markdown documentation into a professionally styled PDF.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, Preformatted
)
from reportlab.platypus.frames import Frame
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.lib import colors
from reportlab.pdfgen import canvas as pdfcanvas
import re
import os

# === Color Palette ===
PILLAR_DARK = HexColor("#1a1a2e")
PILLAR_PRIMARY = HexColor("#16213e")
PILLAR_ACCENT = HexColor("#0f3460")
PILLAR_HIGHLIGHT = HexColor("#e94560")
PILLAR_LIGHT_BG = HexColor("#f5f5f5")
PILLAR_BORDER = HexColor("#d0d0d0")
PILLAR_TEXT = HexColor("#2c2c2c")
PILLAR_MUTED = HexColor("#666666")
PILLAR_GREEN = HexColor("#2d6a4f")
PILLAR_BLUE = HexColor("#1565c0")
PILLAR_CODE_BG = HexColor("#f0f0f0")
PILLAR_CODE_BORDER = HexColor("#cccccc")
TABLE_HEADER_BG = HexColor("#16213e")
TABLE_ALT_ROW = HexColor("#f8f9fa")

# === Page Setup ===
PAGE_WIDTH, PAGE_HEIGHT = letter
LEFT_MARGIN = 0.75 * inch
RIGHT_MARGIN = 0.75 * inch
TOP_MARGIN = 0.85 * inch
BOTTOM_MARGIN = 0.75 * inch
CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "PILLAR-Documentation.pdf")


class PillarDocTemplate(BaseDocTemplate):
    """Custom document template with headers and footers."""

    def __init__(self, filename, **kwargs):
        super().__init__(filename, **kwargs)
        frame = Frame(
            LEFT_MARGIN, BOTTOM_MARGIN,
            CONTENT_WIDTH, PAGE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN,
            id='main'
        )
        template = PageTemplate(id='main', frames=frame, onPage=self.add_page_elements)
        self.addPageTemplates([template])
        self.page_count = 0

    def add_page_elements(self, canvas, doc):
        canvas.saveState()
        self.page_count += 1

        # Header line
        canvas.setStrokeColor(PILLAR_ACCENT)
        canvas.setLineWidth(1.5)
        canvas.line(LEFT_MARGIN, PAGE_HEIGHT - 0.6 * inch, PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 0.6 * inch)

        # Header text
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(PILLAR_MUTED)
        canvas.drawString(LEFT_MARGIN, PAGE_HEIGHT - 0.52 * inch, "PILLAR: Smart Legislation -- AI for Local Government")
        canvas.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 0.52 * inch, "Technical Documentation v1.0.0")

        # Footer
        canvas.setStrokeColor(PILLAR_BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(LEFT_MARGIN, 0.55 * inch, PAGE_WIDTH - RIGHT_MARGIN, 0.55 * inch)

        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(PILLAR_MUTED)
        canvas.drawString(LEFT_MARGIN, 0.4 * inch, "June 2026  |  Confidential")
        canvas.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, 0.4 * inch, f"Page {self.page_count}")

        canvas.restoreState()


def build_styles():
    """Create all paragraph styles for the document."""
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        'CoverTitle',
        fontName='Helvetica-Bold',
        fontSize=28,
        leading=34,
        textColor=PILLAR_DARK,
        alignment=TA_CENTER,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        'CoverSubtitle',
        fontName='Helvetica',
        fontSize=14,
        leading=20,
        textColor=PILLAR_ACCENT,
        alignment=TA_CENTER,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        'CoverMeta',
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=PILLAR_MUTED,
        alignment=TA_CENTER,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        'H1',
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=26,
        textColor=PILLAR_DARK,
        spaceBefore=24,
        spaceAfter=12,
        keepWithNext=True,
    ))
    styles.add(ParagraphStyle(
        'H2',
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=20,
        textColor=PILLAR_PRIMARY,
        spaceBefore=18,
        spaceAfter=8,
        keepWithNext=True,
    ))
    styles.add(ParagraphStyle(
        'H3',
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=PILLAR_ACCENT,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    ))
    styles.add(ParagraphStyle(
        'H4',
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=PILLAR_ACCENT,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    ))
    styles.add(ParagraphStyle(
        'BodyText2',
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=PILLAR_TEXT,
        alignment=TA_JUSTIFY,
        spaceBefore=2,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        'BulletItem',
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=PILLAR_TEXT,
        leftIndent=18,
        bulletIndent=6,
        spaceBefore=1,
        spaceAfter=3,
    ))
    styles.add(ParagraphStyle(
        'CodeBlock',
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=PILLAR_TEXT,
        leftIndent=12,
        rightIndent=12,
        spaceBefore=6,
        spaceAfter=6,
        backColor=PILLAR_CODE_BG,
        borderWidth=0.5,
        borderColor=PILLAR_CODE_BORDER,
        borderPadding=(6, 8, 6, 8),
    ))
    styles.add(ParagraphStyle(
        'InlineCode',
        fontName='Courier',
        fontSize=8.5,
        leading=12,
        textColor=HexColor("#c7254e"),
        backColor=HexColor("#f9f2f4"),
    ))
    styles.add(ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=white,
        alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=PILLAR_TEXT,
        alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        'TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=PILLAR_TEXT,
        alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        'SectionDivider',
        fontName='Helvetica',
        fontSize=1,
        leading=1,
        spaceBefore=4,
        spaceAfter=4,
    ))
    return styles


def format_inline(text):
    """Convert inline markdown to reportlab XML tags."""
    # Escape XML special chars first (but preserve our markdown markers)
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')

    # Extract inline code spans FIRST and replace with placeholders
    # This prevents bold/italic regex from matching * inside code
    code_spans = []
    def _extract_code(m):
        idx = len(code_spans)
        code_spans.append(m.group(1).replace('*', ''))  # strip * from code content
        return f'\x00CODE{idx}\x00'
    text = re.sub(r'`([^`]+)`', _extract_code, text)

    # Bold + italic
    text = re.sub(r'\*\*\*(.*?)\*\*\*', r'<b><i>\1</i></b>', text)
    # Bold
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    # Italic (non-greedy, single line)
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)

    # Restore code spans with font styling
    for idx, code_text in enumerate(code_spans):
        text = text.replace(
            f'\x00CODE{idx}\x00',
            f'<font face="Courier" size="8" color="#c7254e" backColor="#f9f2f4">&nbsp;{code_text}&nbsp;</font>'
        )

    # Links
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2" color="#1565c0">\1</a>', text)
    # Em dash
    text = text.replace(" -- ", " &mdash; ")
    text = text.replace(" --", " &mdash;")
    text = text.replace("-- ", "&mdash; ")
    # Ellipsis
    text = text.replace("...", "&#8230;")
    return text


def parse_markdown_to_elements(md_text, styles):
    """Parse the markdown document into reportlab flowable elements."""
    elements = []
    lines = md_text.split('\n')
    i = 0
    in_code_block = False
    code_buffer = []

    while i < len(lines):
        line = lines[i]

        # --- Code blocks ---
        if line.strip().startswith('```'):
            if in_code_block:
                # End code block
                code_text = '\n'.join(code_buffer)
                # Escape XML
                code_text = code_text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                code_text = code_text.replace(' ', '&nbsp;')
                code_text = code_text.replace('\n', '<br/>')
                elements.append(Paragraph(code_text, styles['CodeBlock']))
                code_buffer = []
                in_code_block = False
            else:
                in_code_block = True
                code_buffer = []
            i += 1
            continue

        if in_code_block:
            code_buffer.append(line)
            i += 1
            continue

        # --- Horizontal rules ---
        if line.strip() == '---':
            elements.append(HRFlowable(
                width="100%", thickness=1, color=PILLAR_BORDER,
                spaceBefore=8, spaceAfter=8
            ))
            i += 1
            continue

        # --- Empty lines ---
        if not line.strip():
            elements.append(Spacer(1, 4))
            i += 1
            continue

        # --- Headers ---
        header_match = re.match(r'^(#{1,4})\s+(.*)', line)
        if header_match:
            level = len(header_match.group(1))
            text = format_inline(header_match.group(2))
            if level == 1:
                elements.append(Spacer(1, 8))
                elements.append(HRFlowable(width="100%", thickness=2, color=PILLAR_ACCENT, spaceBefore=4, spaceAfter=2))
                elements.append(Paragraph(text, styles['H1']))
            elif level == 2:
                elements.append(Paragraph(text, styles['H2']))
                elements.append(HRFlowable(width="30%", thickness=1, color=PILLAR_HIGHLIGHT, spaceBefore=0, spaceAfter=6))
            elif level == 3:
                elements.append(Paragraph(text, styles['H3']))
            elif level == 4:
                elements.append(Paragraph(text, styles['H4']))
            i += 1
            continue

        # --- Tables ---
        if '|' in line and i + 1 < len(lines) and re.match(r'^\s*\|[\s\-:|]+\|\s*$', lines[i + 1].strip()):
            table_lines = []
            while i < len(lines) and '|' in lines[i]:
                table_lines.append(lines[i])
                i += 1
            elements.extend(build_table(table_lines, styles))
            continue

        # --- Bullet points ---
        bullet_match = re.match(r'^(\s*)-\s+(.*)', line)
        if bullet_match:
            indent_level = len(bullet_match.group(1)) // 2
            text = format_inline(bullet_match.group(2))
            left_indent = 18 + indent_level * 16
            bullet_indent = 6 + indent_level * 16
            bullet_style = ParagraphStyle(
                'BulletItemDyn',
                parent=styles['BulletItem'],
                leftIndent=left_indent,
                bulletIndent=bullet_indent,
            )
            elements.append(Paragraph(f"\u2022  {text}", bullet_style))
            i += 1
            continue

        # --- Numbered lists ---
        num_match = re.match(r'^(\s*)\d+\.\s+(.*)', line)
        if num_match:
            text = format_inline(num_match.group(2))
            indent_level = len(num_match.group(1)) // 3
            left_indent = 18 + indent_level * 16
            bullet_indent = 6 + indent_level * 16
            num_style = ParagraphStyle(
                'NumItemDyn',
                parent=styles['BulletItem'],
                leftIndent=left_indent,
                bulletIndent=bullet_indent,
            )
            # Extract the number
            num_text = re.match(r'^(\s*)(\d+)\.', line).group(2)
            elements.append(Paragraph(f"{num_text}.  {text}", num_style))
            i += 1
            continue

        # --- Regular paragraphs ---
        text = format_inline(line.strip())
        if text:
            elements.append(Paragraph(text, styles['BodyText2']))
        i += 1

    return elements


def build_table(table_lines, styles):
    """Convert markdown table lines into a reportlab Table."""
    elements = []
    rows = []

    for idx, line in enumerate(table_lines):
        cells = [c.strip() for c in line.split('|')]
        # Remove empty first/last from leading/trailing pipes
        if cells and cells[0] == '':
            cells = cells[1:]
        if cells and cells[-1] == '':
            cells = cells[:-1]

        # Skip separator row
        if all(re.match(r'^[\s\-:]+$', c) for c in cells):
            continue

        rows.append(cells)

    if not rows:
        return elements

    # Determine column widths
    num_cols = max(len(r) for r in rows)
    col_widths = [CONTENT_WIDTH / num_cols] * num_cols

    # Adjust for known patterns - if first column is narrow (like a setting name)
    if num_cols >= 2:
        # Check if first column looks like labels
        first_col_avg = sum(len(r[0]) for r in rows if len(r) > 0) / max(len(rows), 1)
        if first_col_avg < 25 and num_cols == 2:
            col_widths = [CONTENT_WIDTH * 0.3, CONTENT_WIDTH * 0.7]
        elif first_col_avg < 20 and num_cols == 3:
            col_widths = [CONTENT_WIDTH * 0.22, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.6]
        elif first_col_avg < 20 and num_cols == 4:
            col_widths = [CONTENT_WIDTH * 0.2, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.56]

    # Build table data with Paragraph objects
    table_data = []
    for row_idx, row in enumerate(rows):
        # Pad row to num_cols
        while len(row) < num_cols:
            row.append('')

        styled_row = []
        for col_idx, cell_text in enumerate(row):
            formatted = format_inline(cell_text)
            if row_idx == 0:
                styled_row.append(Paragraph(formatted, styles['TableHeader']))
            else:
                if col_idx == 0:
                    styled_row.append(Paragraph(formatted, styles['TableCellBold']))
                else:
                    styled_row.append(Paragraph(formatted, styles['TableCell']))
        table_data.append(styled_row)

    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    # Table styling
    style_commands = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, PILLAR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
    ]

    # Alternating row colors
    for row_idx in range(1, len(table_data)):
        if row_idx % 2 == 0:
            style_commands.append(('BACKGROUND', (0, row_idx), (-1, row_idx), TABLE_ALT_ROW))

    table.setStyle(TableStyle(style_commands))
    elements.append(Spacer(1, 6))
    elements.append(table)
    elements.append(Spacer(1, 8))
    return elements


def build_cover_page(styles):
    """Create the cover page elements."""
    elements = []

    elements.append(Spacer(1, 1.5 * inch))

    # Accent bar
    elements.append(HRFlowable(width="40%", thickness=3, color=PILLAR_HIGHLIGHT, spaceBefore=0, spaceAfter=20))

    elements.append(Paragraph("PILLAR", styles['CoverTitle']))
    elements.append(Paragraph("Smart Legislation &mdash; AI for Local Government", styles['CoverSubtitle']))

    elements.append(Spacer(1, 0.3 * inch))
    elements.append(HRFlowable(width="20%", thickness=1, color=PILLAR_BORDER, spaceBefore=0, spaceAfter=20))

    elements.append(Paragraph("Comprehensive Technical Documentation<br/>&amp; Reference Guide", styles['CoverMeta']))

    elements.append(Spacer(1, 0.6 * inch))

    meta_style = ParagraphStyle('MetaItem', parent=styles['CoverMeta'], fontSize=9.5, leading=14)
    elements.append(Paragraph("<b>Version:</b> 1.0.0", meta_style))
    elements.append(Paragraph("<b>Date:</b> June 2026", meta_style))
    elements.append(Paragraph("<b>Repository:</b> PILLAR Standalone", meta_style))
    elements.append(Paragraph("<b>Target:</b> Alibaba Cloud ECS with Docker", meta_style))

    elements.append(Spacer(1, 1.2 * inch))

    elements.append(HRFlowable(width="60%", thickness=0.5, color=PILLAR_BORDER, spaceBefore=0, spaceAfter=12))

    disclaimer_style = ParagraphStyle('Disclaimer', parent=styles['CoverMeta'], fontSize=8, leading=11, textColor=PILLAR_MUTED)
    elements.append(Paragraph(
        "Platform for Intelligent Local Legislation and Administrative Reform.<br/>"
        "AI-powered legislative support for Philippine Local Government Units.",
        disclaimer_style
    ))

    elements.append(PageBreak())
    return elements


def build_toc(styles):
    """Build a table of contents page."""
    elements = []

    elements.append(Paragraph("Table of Contents", styles['H1']))
    elements.append(HRFlowable(width="100%", thickness=1, color=PILLAR_ACCENT, spaceBefore=0, spaceAfter=12))

    toc_items = [
        ("1.", "Executive Summary", "Design objectives, justification, and when to apply PILLAR"),
        ("2.", "System Architecture", "High-level architecture, component diagram, data flows"),
        ("3.", "Technology Stack", "Frontend, backend, AI/ML, and infrastructure"),
        ("4.", "Knowledge Base Architecture", "BM25 + LightRAG hybrid search, citation validation"),
        ("5.", "Authentication &amp; Authorization", "Session-based auth, role-based access control"),
        ("6.", "Admin Interface Guide", "Dashboard, KB management, deployments, ECS"),
        ("7.", "Deployment Architecture", "Docker, nginx, multi-tenant LGU strategy"),
        ("8.", "Database Schema", "Tables, indexes, SQLite configuration"),
        ("9.", "API Reference", "All public, auth, and admin endpoints"),
        ("10.", "Security Considerations", "Current posture and production hardening areas"),
        ("11.", "Philippine Legal Domain Specificity", "LGU classification, bilingual processing"),
        ("12.", "Roadmap &amp; Future Enhancements", "Immediate, medium-term, and long-term priorities"),
        ("A.", "File Structure", "Complete project directory listing"),
        ("B.", "Default Configuration Values", "All tuning parameters and defaults"),
    ]

    for num, title, desc in toc_items:
        toc_style = ParagraphStyle(
            f'TOC_{num}',
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=PILLAR_TEXT,
            leftIndent=12,
            spaceBefore=4,
            spaceAfter=2,
        )
        desc_style = ParagraphStyle(
            f'TOCDesc_{num}',
            fontName='Helvetica',
            fontSize=8.5,
            leading=11,
            textColor=PILLAR_MUTED,
            leftIndent=42,
            spaceBefore=0,
            spaceAfter=4,
        )
        elements.append(Paragraph(f"<b>{num}</b>&nbsp;&nbsp;&nbsp;{title}", toc_style))
        elements.append(Paragraph(desc, desc_style))

    elements.append(PageBreak())
    return elements


def main():
    # Read the markdown source
    md_path = os.path.join(os.path.dirname(__file__), "PILLAR-Documentation.md")
    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Build styles
    styles = build_styles()

    # Create the PDF document
    doc = PillarDocTemplate(
        OUTPUT_PATH,
        pagesize=letter,
        title="PILLAR: Smart Legislation -- Technical Documentation",
        author="PILLAR Development Team",
        subject="AI-powered legislative support for Philippine LGUs",
    )

    # Build all elements
    all_elements = []

    # Cover page
    all_elements.extend(build_cover_page(styles))

    # Table of contents
    all_elements.extend(build_toc(styles))

    # Parse markdown content
    all_elements.extend(parse_markdown_to_elements(md_content, styles))

    # Build the PDF
    doc.build(all_elements)
    print(f"PDF generated successfully: {OUTPUT_PATH}")
    print(f"File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")


if __name__ == '__main__':
    main()
