"""
PILLAR VPS Deployment Guide - PDF Generator
"""

import os
import sys

# Reuse the PDF generation logic from the main documentation generator
sys.path.insert(0, os.path.dirname(__file__))
from generate_pdf import (
    PillarDocTemplate, build_styles, build_cover_page,
    parse_markdown_to_elements, format_inline
)

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    Paragraph, Spacer, HRFlowable, PageBreak
)

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "PILLAR-VPS-Deployment-Guide.pdf")
MD_PATH = os.path.join(os.path.dirname(__file__), "PILLAR-VPS-Deployment-Guide.md")

PILLAR_DARK = HexColor("#1a1a2e")
PILLAR_HIGHLIGHT = HexColor("#e94560")
PILLAR_BORDER = HexColor("#d0d0d0")
PILLAR_MUTED = HexColor("#666666")
PILLAR_ACCENT = HexColor("#0f3460")


def build_vps_cover(styles):
    """Cover page for VPS deployment guide."""
    elements = []
    elements.append(Spacer(1, 1.5 * inch))
    elements.append(HRFlowable(width="40%", thickness=3, color=PILLAR_HIGHLIGHT, spaceBefore=0, spaceAfter=20))
    elements.append(Paragraph("PILLAR", styles['CoverTitle']))
    elements.append(Paragraph("Hostinger VPS Deployment Guide", styles['CoverSubtitle']))
    elements.append(Spacer(1, 0.3 * inch))
    elements.append(HRFlowable(width="20%", thickness=1, color=PILLAR_BORDER, spaceBefore=0, spaceAfter=20))
    elements.append(Paragraph("UAT / Pilot Environment<br/>Configuration &amp; Operations Manual", styles['CoverMeta']))
    elements.append(Spacer(1, 0.6 * inch))

    meta_style = ParagraphStyle('MetaItem', parent=styles['CoverMeta'], fontSize=9.5, leading=14)
    elements.append(Paragraph("<b>Version:</b> 1.0.0", meta_style))
    elements.append(Paragraph("<b>Date:</b> July 2026", meta_style))
    elements.append(Paragraph("<b>Environment:</b> Hostinger VPS (UAT)", meta_style))
    elements.append(Paragraph("<b>VPS:</b> 72.60.104.187:2222", meta_style))
    elements.append(Paragraph("<b>Target URL:</b> https://pillar.bayanaihan.net", meta_style))
    elements.append(Spacer(1, 1.2 * inch))
    elements.append(HRFlowable(width="60%", thickness=0.5, color=PILLAR_BORDER, spaceBefore=0, spaceAfter=12))

    disclaimer_style = ParagraphStyle('Disclaimer', parent=styles['CoverMeta'], fontSize=8, leading=11, textColor=PILLAR_MUTED)
    elements.append(Paragraph(
        "Deployment plan for UAT pilot testing of the PILLAR standalone application<br/>"
        "on Hostinger VPS before production deployment to Alibaba Cloud ECS.",
        disclaimer_style
    ))
    elements.append(PageBreak())
    return elements


def build_vps_toc(styles):
    """Table of contents for VPS guide."""
    elements = []
    elements.append(Paragraph("Table of Contents", styles['H1']))
    elements.append(HRFlowable(width="100%", thickness=1, color=PILLAR_ACCENT, spaceBefore=0, spaceAfter=12))

    toc_items = [
        ("1.", "Deployment Overview", "Purpose, UAT vs. production comparison, architecture diagram"),
        ("2.", "VPS Environment Assessment", "Server specs, port allocation, pre-existing infrastructure"),
        ("3.", "ECS-to-VPS Adaptation Analysis", "Required changes, migration mapping"),
        ("4.", "Deployment Procedure", "Step-by-step instructions, deployment script usage"),
        ("5.", "Configuration Files Reference", "docker-compose.vps.yml, .env.vps, nginx details"),
        ("6.", "UAT Testing Checklist", "Module testing, admin panel, LightRAG, performance"),
        ("7.", "Operations &amp; Maintenance", "Logs, restart, rebuild, backup, KB updates, SSL"),
        ("8.", "Monitoring &amp; Health Checks", "Endpoints, Docker health, resource monitoring"),
        ("9.", "Troubleshooting", "Common issues and resolution steps"),
        ("10.", "Post-Deployment Checklist", "Verification items after deployment"),
        ("A.", "VPS Configuration Quick Reference", "All settings at a glance"),
        ("B.", "File Inventory for Deployment", "Required files on VPS"),
    ]

    for num, title, desc in toc_items:
        toc_style = ParagraphStyle(f'TOC_{num}', fontName='Helvetica', fontSize=10, leading=14,
                                   textColor=PILLAR_DARK, leftIndent=12, spaceBefore=4, spaceAfter=2)
        desc_style = ParagraphStyle(f'TOCDesc_{num}', fontName='Helvetica', fontSize=8.5, leading=11,
                                    textColor=PILLAR_MUTED, leftIndent=42, spaceBefore=0, spaceAfter=4)
        elements.append(Paragraph(f"<b>{num}</b>&nbsp;&nbsp;&nbsp;{title}", toc_style))
        elements.append(Paragraph(desc, desc_style))

    elements.append(PageBreak())
    return elements


def main():
    with open(MD_PATH, 'r', encoding='utf-8') as f:
        md_content = f.read()

    styles = build_styles()

    doc = PillarDocTemplate(
        OUTPUT_PATH,
        pagesize=letter,
        title="PILLAR VPS Deployment Guide -- UAT/Pilot",
        author="PILLAR Development Team",
        subject="Hostinger VPS deployment plan for PILLAR UAT testing",
    )

    all_elements = []
    all_elements.extend(build_vps_cover(styles))
    all_elements.extend(build_vps_toc(styles))
    all_elements.extend(parse_markdown_to_elements(md_content, styles))

    doc.build(all_elements)
    print(f"PDF generated: {OUTPUT_PATH}")
    print(f"File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")


if __name__ == '__main__':
    main()
