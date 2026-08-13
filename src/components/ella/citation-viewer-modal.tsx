'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Database, Brain, AlertTriangle } from 'lucide-react';
import type { Citation } from '@/types';
import { citationToDocId } from '@/lib/citation-doc-id';

// ?????? Helpers for structured KB document rendering ??????????????????????????????????????????????????????

/** Clean wiki-style links: [[target|display]] ??? display, [[target]] ??? target */
function cleanWikiLinks(text: string): string {
  return text
    .replace(/\[\[[^|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
}

/** Strip markdown bold/italic markers: **text** ??? text, _text_ ??? text */
function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/_([^_]+)_/g, '$1');
}

/** Check if text contains markdown sections (## headers) */
function hasMarkdownSections(text: string): boolean {
  return /\r?\n## /.test(text);
}

/** Parse Case Information list items into key-value pairs */
function parseCaseInfo(content: string): { key: string; value: string }[] {
  return content.split('\n')
    .map(line => {
      const m = line.match(/^\-\s+\*\*(.+?):\*\*\s*(.+)$/);
      return m ? { key: m[1].trim(), value: m[2].trim() } : null;
    })
    .filter((x): x is { key: string; value: string } => x !== null);
}

/** Parse provisions list items into badge labels */
function parseProvisions(content: string): string[] {
  return content.split('\n')
    .map(line => {
      const m = line.match(/^\-\s+\[\[[^|]+\|([^\]]+)\]\]/);
      return m ? m[1].trim() : null;
    })
    .filter((x): x is string => x !== null);
}

/** Extract SYLLABUS from full decision text (between SYLLABUS and APPEARANCES/DECISION) */
function extractSyllabus(text: string): string | null {
  const idx = text.indexOf('SYLLABUS');
  if (idx === -1) return null;
  const after = text.substring(idx + 8).trim();
  const endMarkers = ['APPEARANCES OF COUNSEL', 'D E C I S I O N'];
  let endIdx = after.length;
  for (const marker of endMarkers) {
    const i = after.indexOf(marker);
    if (i > 0 && i < endIdx) endIdx = i;
  }
  const result = after.substring(0, endIdx).trim();
  return result.length > 20 ? result : null;
}

/** Parse syllabus into individual numbered holdings */
function parseSyllabusItems(syllabusText: string): string[] {
  return syllabusText
    .split(/\n(?=\d+\.\s)/)
    .map(h => h.replace(/^\d+\.\s*/, '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(h => h.length > 10);
}

interface ParsedSection {
  title: string;
  content: string;
  type: 'info' | 'provisions' | 'holdings' | 'fulltext' | 'related' | 'generic';
}

/** Parse markdown full text into structured sections */
function parseMarkdownSections(fullText: string): ParsedSection[] {
  const parts = fullText.split(/\r?\n## /);
  const sections: ParsedSection[] = [];
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const nl = part.indexOf('\n');
    const title = nl > 0 ? part.substring(0, nl).trim() : part.trim();
    const content = nl > 0 ? part.substring(nl + 1).trim() : '';
    const tl = title.toLowerCase();
    let type: ParsedSection['type'] = 'generic';
    if (tl.includes('case info')) type = 'info';
    else if (tl.includes('provisions')) type = 'provisions';
    else if (tl.includes('holding')) type = 'holdings';
    else if (tl.includes('full decision') || tl.includes('decision text')) type = 'fulltext';
    else if (tl.includes('related')) type = 'related';
    sections.push({ title, content, type });
  }
  return sections;
}

interface CitationViewerModalProps {
  citation: Citation | null;
  onClose: () => void;
}

export default function CitationViewerModal({ citation, onClose }: CitationViewerModalProps) {
  const [fullText, setFullText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [llmInfo, setLlmInfo] = useState<{
    summary: string;
    case_title: string | null;
    date: string | null;
    key_ruling: string | null;
    confidence: string;
  } | null>(null);
  const [showFullDecision, setShowFullDecision] = useState(false);

  useEffect(() => {
    if (!citation) {
      setFullText(null);
      setError(false);
      setLlmInfo(null);
      setShowFullDecision(false);
      return;
    }

    // Determine source
    const source = citation.source ?? (citation.verified === false ? 'llm' : citation.verified ? 'kb' : undefined);
    const docId = citationToDocId(citation) || citation.doc_id;

    // KB-sourced with a docId: fetch full document text
    if (source === 'kb' && docId) {
      setLoading(true);
      setError(false);
      setFullText(null);
      setLlmInfo(null);
      setShowFullDecision(false);

      fetch(`/api/documents/${encodeURIComponent(docId)}`)
        .then((res) => {
          if (!res.ok) throw new Error('Not found');
          return res.json();
        })
        .then((data) => {
          setFullText(data.full_text || null);
          if (!data.full_text) setError(true);
        })
        .catch(() => {
          setError(true);
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }

    // LLM-sourced (or no docId): fetch AI-generated summary
    setLoading(true);
    setError(false);
    setFullText(null);
    setLlmInfo(null);
    setShowFullDecision(false);

    fetch('/api/citation-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citation: citation.section,
        doc_type: citation.doc_type || '',
        title: citation.title || '',
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((data) => {
        setLlmInfo(data);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [citation]);

  const docTypeConfig: Record<string, { label: string; bg: string }> = {
    ra7160: { label: 'R.A. 7160', bg: 'bg-[hsl(239_76%_64%/0.15)] text-[hsl(239_76%_80%)]' },
    ordinance: { label: 'Ordinance', bg: 'bg-[hsl(158_64%_45%/0.15)] text-[hsl(158_64%_70%)]' },
    irr: { label: 'IRR', bg: 'bg-[hsl(270_70%_60%/0.15)] text-[hsl(270_70%_80%)]' },
    dilg_opinion: { label: 'DILG Op.', bg: 'bg-[hsl(30_90%_50%/0.15)] text-[hsl(30_90%_70%)]' },
    jurisprudence: { label: 'SC Case', bg: 'bg-[hsl(340_75%_55%/0.15)] text-[hsl(340_75%_75%)]' },
  };

  const cfg = docTypeConfig[citation?.doc_type || 'ra7160'] || docTypeConfig.ra7160;

  // Source-based banner
  const sourceBanner = (() => {
    if (!citation) return null;

    // Derive source from verified field for backward compat
    const source = citation.source ?? (citation.verified === false ? 'llm' : citation.verified ? 'kb' : undefined);
    if (!source) return null;

    if (source === 'kb') {
      return (
        <div className="flex items-center gap-2 rounded-md bg-sky-500/10 border border-sky-500/20 px-3 py-2">
          <Database className="h-4 w-4 text-sky-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-sky-400">Found in Knowledge Base</p>
            <p className="text-[10px] text-sky-400/70">This citation was verified against the legal database.</p>
          </div>
        </div>
      );
    }

    // LLM-sourced
    if (citation.relevance_rating === 'high') {
      return (
        <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <Brain className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-400">LLM-Generated (High Relevance)</p>
            <p className="text-[10px] text-amber-400/70">This citation was not found in the knowledge base, but it is referenced in related legal documents. Recommended for verification and KB inclusion.</p>
          </div>
        </div>
      );
    }

    if (citation.relevance_rating === 'medium') {
      return (
        <div className="flex items-center gap-2 rounded-md bg-orange-500/10 border border-orange-500/20 px-3 py-2">
          <Brain className="h-4 w-4 text-orange-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-orange-400">LLM-Generated (Medium Relevance)</p>
            <p className="text-[10px] text-orange-400/70">This citation is properly formatted but was not found in the knowledge base. Requires verification before inclusion.</p>
          </div>
        </div>
      );
    }

    // Low relevance
    return (
      <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
        <Brain className="h-4 w-4 text-red-400 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-red-400">LLM-Generated (Low Relevance)</p>
          <p className="text-[10px] text-red-400/70">This citation could not be verified. It may be inaccurate or hallucinated.</p>
        </div>
      </div>
    );
  })();

  return (
    <Dialog open={!!citation} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] bg-[hsl(222_47%_11%)] border border-[hsl(224_27%_22%)] text-[hsl(214_100%_97%)] overflow-hidden flex flex-col gap-0 p-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-start gap-3 text-[hsl(214_100%_97%)]">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold shrink-0 ${cfg.bg}`}>
              {cfg.label}
            </span>
            <span className="text-sm font-bold">{citation?.section}</span>
          </DialogTitle>
          <p className="mt-1.5 text-xs text-[hsl(239_76%_80%)]">{citation?.title}</p>
        </div>
        <Separator className="bg-[hsl(224_27%_22%)]" />

        {/* Source banner */}
        {sourceBanner && (
          <div className="px-5 pt-3">
            {sourceBanner}
          </div>
        )}

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0 max-h-[60vh]">
          <div className="px-5 pb-5">
            {loading && (
              <div className="flex items-center gap-2 py-10 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-[hsl(239_76%_64%)]" />
                <span className="text-xs text-[hsl(216_20%_55%)]">Retrieving citation information...</span>
              </div>
            )}

            {!loading && error && (
              <div className="py-10 text-center">
                <p className="text-xs text-[hsl(216_20%_55%)]">
                  Information could not be retrieved for this citation.
                </p>
                <p className="mt-2 text-xs text-[hsl(216_20%_40%)]">{citation?.text}</p>
              </div>
            )}

            {!loading && llmInfo && (
              <div className="space-y-3">
                {/* AI disclaimer */}
                <div className="flex items-start gap-2 rounded-md bg-amber-500/5 border border-amber-500/15 px-3 py-2">
                  <Brain className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-400/70 leading-relaxed">
                    This summary was generated by the AI based on its training data, not from the PILLAR knowledge base. Verify before relying on it for legal decisions.
                  </p>
                </div>

                {/* Metadata */}
                {llmInfo.case_title && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">Case Title</span>
                    <p className="mt-0.5 text-xs text-[hsl(214_100%_97%)]">{llmInfo.case_title}</p>
                  </div>
                )}
                {llmInfo.date && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">Date</span>
                    <p className="mt-0.5 text-xs text-[hsl(214_100%_97%)]">{llmInfo.date}</p>
                  </div>
                )}
                {llmInfo.key_ruling && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">Key Ruling</span>
                    <p className="mt-0.5 text-xs text-[hsl(214_100%_97%)]">{llmInfo.key_ruling}</p>
                  </div>
                )}

                {/* Summary */}
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">Summary</span>
                  <div className="mt-0.5 space-y-1.5">
                    {llmInfo.summary.split('\n').map((paragraph, i) => (
                      paragraph.trim() ? (
                        <p key={i} className="text-xs leading-relaxed text-[hsl(216_20%_75%)]">{paragraph}</p>
                      ) : null
                    ))}
                  </div>
                </div>

                {/* Confidence */}
                <div className="flex items-center gap-2 pt-1 border-t border-[hsl(224_27%_22%)]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">AI Confidence</span>
                  <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${
                    llmInfo.confidence === 'high'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : llmInfo.confidence === 'medium'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-red-500/15 text-red-400'
                  }`}>
                    {llmInfo.confidence === 'high' ? 'High' : llmInfo.confidence === 'medium' ? 'Medium' : 'Low'}
                  </span>
                  {llmInfo.confidence === 'low' && (
                    <span className="flex items-center gap-1 text-[10px] text-red-400/70">
                      <AlertTriangle className="h-3 w-3" />
                      The AI could not find reliable information about this citation.
                    </span>
                  )}
                </div>
              </div>
            )}

            {!loading && fullText && (
              hasMarkdownSections(fullText) ? (() => {
                const sections = parseMarkdownSections(fullText);
                const fullTextSection = sections.find(s => s.type === 'fulltext');
                const syllabus = fullTextSection ? extractSyllabus(fullTextSection.content) : null;
                const syllabusItems = syllabus ? parseSyllabusItems(syllabus) : [];
                const holdingsSection = sections.find(s => s.type === 'holdings');
                const isPlaceholderHoldings = holdingsSection && /see full decision/i.test(holdingsSection.content);
                const realHoldingsText = (!isPlaceholderHoldings && holdingsSection) ? holdingsSection.content : null;

                return (
                  <div className="space-y-4">
                    {/* Case Information */}
                    {sections.filter(s => s.type === 'info').map((section, si) => {
                      const pairs = parseCaseInfo(section.content);
                      if (!pairs.length) return null;
                      return (
                        <div key={`info-${si}`}>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">Case Information</span>
                          <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                            {pairs.map((p, pi) => (
                              <div key={pi} className="rounded-md border border-[hsl(224_27%_22%)] bg-[hsl(222_47%_9%)] px-2.5 py-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">{p.key}</span>
                                <p className="mt-0.5 text-xs text-[hsl(214_100%_97%)]">{cleanWikiLinks(p.value)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Provisions Cited */}
                    {sections.filter(s => s.type === 'provisions').map((section, si) => {
                      const provs = parseProvisions(section.content);
                      if (!provs.length) return null;
                      return (
                        <div key={`prov-${si}`}>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">{section.title}</span>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {provs.map((p, pi) => (
                              <span key={pi} className="rounded border border-[hsl(239_76%_64%/0.3)] bg-[hsl(239_76%_64%/0.1)] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(239_76%_80%)]">{p}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Key Holdings (from syllabus or holdings section) */}
                    {syllabusItems.length > 0 ? (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">Key Holdings</span>
                        <div className="mt-1.5 space-y-2 rounded-md border border-[hsl(224_27%_22%)] bg-[hsl(222_47%_9%)] p-2.5">
                          {syllabusItems.map((holding, i) => (
                            <div key={i} className="flex gap-2">
                              <span className="shrink-0 text-[10px] font-bold text-[hsl(239_76%_64%)]">{i + 1}</span>
                              <p className="text-xs leading-relaxed text-[hsl(216_20%_75%)]">{cleanWikiLinks(stripMarkdown(holding))}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : realHoldingsText ? (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">Key Holdings</span>
                        <div className="mt-1.5 space-y-1.5 rounded-md border border-[hsl(224_27%_22%)] bg-[hsl(222_47%_9%)] p-2.5">
                          {realHoldingsText.split('\n').map((p, i) => p.trim() ? (
                            <p key={i} className="text-xs leading-relaxed text-[hsl(216_20%_75%)]">{cleanWikiLinks(stripMarkdown(p.trim()))}</p>
                          ) : null)}
                        </div>
                      </div>
                    ) : null}

                    {/* Full Decision Text (collapsible) */}
                    {fullTextSection && (
                      <div>
                        <button
                          onClick={() => setShowFullDecision(!showFullDecision)}
                          className="flex w-full items-center justify-between rounded-md border border-[hsl(224_27%_22%)] bg-[hsl(222_47%_9%)] px-3 py-2 text-xs font-semibold text-[hsl(214_100%_97%)] transition-colors hover:border-[hsl(239_76%_64%/0.3)]"
                        >
                          <span>Full Decision Text</span>
                          <span className="text-[10px] text-[hsl(216_20%_50%)]">{showFullDecision ? 'Hide' : 'Show'}</span>
                        </button>
                        {showFullDecision && (
                          <div className="mt-2 max-h-60 overflow-y-auto overflow-x-hidden rounded-md border border-[hsl(224_27%_22%)] bg-[hsl(222_47%_9%)] p-3">
                            {fullTextSection.content.split('\n').map((p, i) => p.trim() ? (
                              <p key={i} className="text-xs leading-relaxed text-[hsl(216_20%_65%)] mb-1.5">{cleanWikiLinks(stripMarkdown(p.trim()))}</p>
                            ) : null)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Related */}
                    {sections.filter(s => s.type === 'related').map((section, si) => {
                      const items = section.content.split('\n')
                        .map(l => cleanWikiLinks(l.replace(/^\-\s+/, '').trim()))
                        .filter(l => l);
                      if (!items.length) return null;
                      return (
                        <div key={`rel-${si}`}>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">{section.title}</span>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {items.map((item, ii) => (
                              <span key={ii} className="rounded border border-[hsl(224_27%_22%)] bg-[hsl(222_47%_9%)] px-1.5 py-0.5 text-[10px] text-[hsl(216_20%_60%)]">{item}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                // Plain text rendering (for RA7160, DILG opinions, ordinances)
                <div className="space-y-2">
                  {fullText.split('\n').map((paragraph, i) => (
                    paragraph.trim() ? (
                      <p key={i} className="text-xs leading-relaxed text-[hsl(216_20%_75%)]">
                        {paragraph}
                      </p>
                    ) : null
                  ))}
                </div>
              )
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
