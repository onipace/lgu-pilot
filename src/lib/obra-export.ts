'use client';

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';

/**
 * Generate and download a DOCX file from ordinance draft text.
 * Parses the plain text into paragraphs with basic heading detection.
 */
export async function exportAsDocx(text: string, title: string = 'Ordinance Draft') {
  const lines = text.split('\n');
  const children: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ children: [] }));
      continue;
    }

    // Detect section headings (e.g., "SECTION 1.", "Section 2.", "WHEREAS,")
    const isSectionHeading = /^SECTION\s+\d+/i.test(trimmed);
    const isWhereas = /^WHEREAS[,:]/i.test(trimmed);
    const isTitle = /^ORDINANCE\s+NO\./i.test(trimmed) || /^AN\s+ORDINANCE/i.test(trimmed);
    const isBeItEnacted = /^BE\s+IT\s+ENACTED/i.test(trimmed);

    if (isTitle) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: 28, font: 'Georgia' })],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }));
    } else if (isSectionHeading) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: 24, font: 'Georgia' })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }));
    } else if (isWhereas) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, italics: true, size: 22, font: 'Georgia' })],
        spacing: { after: 100 },
      }));
    } else if (isBeItEnacted) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: 22, font: 'Georgia' })],
        spacing: { before: 200, after: 100 },
      }));
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 22, font: 'Georgia' })],
        spacing: { after: 80 },
        indent: /^\s+/.test(line) ? { left: 720 } : undefined,
      }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${title}.docx`);
}

/**
 * Generate and download a PDF file from ordinance draft text.
 * Uses jsPDF with basic formatting.
 */
export function exportAsPdf(text: string, title: string = 'Ordinance Draft') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 25;
  const usableWidth = pageWidth - margin * 2;
  let y = margin;

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      y += 4;
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      continue;
    }

    // Detect formatting
    const isSectionHeading = /^SECTION\s+\d+/i.test(trimmed);
    const isWhereas = /^WHEREAS[,:]/i.test(trimmed);
    const isTitle = /^ORDINANCE\s+NO\./i.test(trimmed) || /^AN\s+ORDINANCE/i.test(trimmed);
    const isBeItEnacted = /^BE\s+IT\s+ENACTED/i.test(trimmed);

    let fontSize = 11;
    let fontStyle = 'normal';
    let indent = 0;

    if (isTitle) {
      fontSize = 14;
      fontStyle = 'bold';
    } else if (isSectionHeading) {
      fontSize = 12;
      fontStyle = 'bold';
      y += 3;
    } else if (isWhereas) {
      fontStyle = 'italic';
    } else if (isBeItEnacted) {
      fontStyle = 'bold';
      y += 3;
    } else if (/^\s+/.test(line)) {
      indent = 5;
    }

    doc.setFont('times', fontStyle);
    doc.setFontSize(fontSize);

    const splitLines = doc.splitTextToSize(trimmed, usableWidth - indent);

    for (const splitLine of splitLines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }

      if (isTitle) {
        doc.text(splitLine, pageWidth / 2, y, { align: 'center' });
      } else {
        doc.text(splitLine, margin + indent, y);
      }
      y += fontSize * 0.45;
    }

    y += 1;
  }

  doc.save(`${title}.pdf`);
}

/**
 * Extract a reasonable filename from the draft text.
 */
export function extractTitle(draftText: string): string {
  const lines = draftText.split('\n').filter(l => l.trim());
  // Try to find an "AN ORDINANCE" or "ORDINANCE NO." line
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (/^(AN\s+ORDINANCE|ORDINANCE\s+NO\.)/i.test(trimmed)) {
      // Clean up for filename
      const clean = trimmed.substring(0, 60).replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      return clean || 'Ordinance Draft';
    }
  }
  // Fallback: use the first non-empty line
  const first = lines[0]?.trim().substring(0, 60).replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  return first || 'Ordinance Draft';
}
