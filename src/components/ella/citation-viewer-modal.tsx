'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import type { Citation } from '@/types';
import { citationToDocId } from '@/lib/citation-doc-id';

interface CitationViewerModalProps {
  citation: Citation | null;
  onClose: () => void;
}

export default function CitationViewerModal({ citation, onClose }: CitationViewerModalProps) {
  const [fullText, setFullText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!citation) {
      setFullText(null);
      setError(false);
      return;
    }

    const docId = citationToDocId(citation) || citation.doc_id;
    if (!docId) {
      setFullText(null);
      setError(true);
      return;
    }

    setLoading(true);
    setError(false);
    setFullText(null);

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
  }, [citation]);

  const docTypeConfig: Record<string, { label: string; bg: string }> = {
    ra7160: { label: 'R.A. 7160', bg: 'bg-[hsl(239_76%_64%/0.15)] text-[hsl(239_76%_80%)]' },
    ordinance: { label: 'Ordinance', bg: 'bg-[hsl(158_64%_45%/0.15)] text-[hsl(158_64%_70%)]' },
    irr: { label: 'IRR', bg: 'bg-[hsl(270_70%_60%/0.15)] text-[hsl(270_70%_80%)]' },
    dilg_opinion: { label: 'DILG Op.', bg: 'bg-[hsl(30_90%_50%/0.15)] text-[hsl(30_90%_70%)]' },
    jurisprudence: { label: 'SC Case', bg: 'bg-[hsl(340_75%_55%/0.15)] text-[hsl(340_75%_75%)]' },
  };

  const cfg = docTypeConfig[citation?.doc_type || 'ra7160'] || docTypeConfig.ra7160;

  // Verification status banner
  const verificationBanner = (() => {
    if (citation?.verified === undefined) return null;

    if (citation.verified && citation.confidence === 'high') {
      return (
        <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-emerald-400">Verified Citation</p>
            <p className="text-[10px] text-emerald-400/70">This section was found in the legal database with high confidence.</p>
          </div>
        </div>
      );
    }

    if (citation.verified && citation.confidence === 'medium') {
      return (
        <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-400">Partial Match</p>
            <p className="text-[10px] text-amber-400/70">The base section exists, but sub-section references could not be fully verified.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
        <ShieldX className="h-4 w-4 text-red-400 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-red-400">Unverified Citation</p>
          <p className="text-[10px] text-red-400/70">This section was NOT found in the legal database. It may be a hallucinated or incorrect citation.</p>
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

        {/* Verification banner */}
        {verificationBanner && (
          <div className="px-5 pt-3">
            {verificationBanner}
          </div>
        )}

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0 max-h-[60vh]">
          <div className="px-5 pb-5">
            {loading && (
              <div className="flex items-center gap-2 py-10 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-[hsl(239_76%_64%)]" />
                <span className="text-xs text-[hsl(216_20%_55%)]">Loading document...</span>
              </div>
            )}

            {!loading && error && (
              <div className="py-10 text-center">
                <p className="text-xs text-[hsl(216_20%_55%)]">
                  Full document text is not available for this citation.
                </p>
                <p className="mt-2 text-xs text-[hsl(216_20%_40%)]">{citation?.text}</p>
              </div>
            )}

            {!loading && fullText && (
              <div className="prose prose-invert prose-sm max-w-none">
                {fullText.split('\n').map((paragraph, i) => (
                  paragraph.trim() ? (
                    <p key={i} className="text-xs leading-relaxed text-[hsl(216_20%_75%)] mb-2">
                      {paragraph}
                    </p>
                  ) : null
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
