'use client';

import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Download, XCircle, ShieldAlert, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import TemplatePicker from '@/components/obra/template-picker';
import type { OrdTemplateType, DraftDetails, ReviewResult, ComplianceRisk, CitationWarning } from '@/types';
import { getOrCreateSessionId } from '@/components/pillar/participant-id';
import { exportAsDocx, exportAsPdf, extractTitle } from '@/lib/obra-export';

const STEPS = [
  { number: 1, label: 'Template' },
  { number: 2, label: 'Details' },
  { number: 3, label: 'Draft' },
  { number: 4, label: 'Review' },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-5 flex items-center justify-center">
      {STEPS.map((step, idx) => (
        <div key={step.number} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors',
              currentStep === step.number ? 'bg-[hsl(158_64%_45%)] text-white'
              : currentStep > step.number ? 'bg-[hsl(158_64%_45%/0.25)] text-[hsl(158_64%_60%)]'
              : 'bg-[hsl(224_35%_17%)] text-[hsl(216_20%_50%)]'
            )}>
              {currentStep > step.number ? <CheckCircle2 className="h-5 w-5" /> : step.number}
            </div>
            <span className={cn('mt-1.5 text-xs font-medium',
              currentStep === step.number ? 'text-[hsl(158_64%_60%)]'
              : currentStep > step.number ? 'text-[hsl(158_64%_50%)]'
              : 'text-[hsl(216_20%_45%)]'
            )}>{step.label}</span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={cn('mx-3 mb-5 h-0.5 w-16 rounded transition-colors',
              currentStep > step.number ? 'bg-[hsl(158_64%_45%/0.5)]' : 'bg-[hsl(224_27%_22%)]'
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

function ScoreDisplay({ score }: { score: number }) {
  const color = score >= 80 ? 'text-[hsl(158_64%_60%)]' : score >= 60 ? 'text-[hsl(38_95%_65%)]' : 'text-red-400';
  const bg = score >= 80 ? 'bg-[hsl(158_64%_45%/0.1)] border-[hsl(158_64%_45%/0.3)]'
    : score >= 60 ? 'bg-[hsl(38_95%_55%/0.1)] border-[hsl(38_95%_55%/0.3)]'
    : 'bg-red-500/10 border-red-500/30';
  const label = score >= 80 ? 'Good Compliance' : score >= 60 ? 'Needs Attention' : 'High Risk';
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border-2 p-6', bg)}>
      <span className={cn('text-5xl font-bold', color)}>{score}</span>
      <span className={cn('mt-1 text-sm font-medium', color)}>{label}</span>
      <span className="mt-0.5 text-xs text-[hsl(216_20%_50%)]">out of 100</span>
    </div>
  );
}

function RiskCard({ risk, citationWarning }: { risk: ComplianceRisk; citationWarning?: CitationWarning }) {
  const cfg = {
    low: { bg: 'bg-[hsl(158_64%_45%/0.08)]', border: 'border-[hsl(158_64%_45%/0.3)]', badge: 'bg-[hsl(158_64%_45%/0.2)] text-[hsl(158_64%_70%)]' },
    medium: { bg: 'bg-[hsl(38_95%_55%/0.08)]', border: 'border-[hsl(38_95%_55%/0.3)]', badge: 'bg-[hsl(38_95%_55%/0.2)] text-[hsl(38_95%_75%)]' },
    high: { bg: 'bg-red-500/5', border: 'border-red-500/30', badge: 'bg-red-500/20 text-red-400' },
  }[risk.severity];
  return (
    <Card className={cn('border', cfg.border, cfg.bg)}>
      <CardContent className="pt-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={cfg.badge}>{risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1)} Risk</Badge>
            {citationWarning && !citationWarning.verified && (
              <Badge className="bg-red-500/20 text-red-400 gap-1">
                <ShieldX className="h-3 w-3" /> Unverified Citation
              </Badge>
            )}
            {citationWarning && citationWarning.verified && citationWarning.confidence === 'medium' && (
              <Badge className="bg-amber-500/20 text-amber-400 gap-1">
                <ShieldAlert className="h-3 w-3" /> Partial Match
              </Badge>
            )}
          </div>
          <span className="text-xs font-medium text-[hsl(216_20%_50%)]">{risk.section}</span>
        </div>
        <p className="mb-2 text-sm font-medium text-[hsl(214_100%_97%)]">{risk.description}</p>
        <div className="flex items-start gap-2 rounded-lg bg-[hsl(224_35%_17%)] p-2.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(158_64%_50%)]" />
          <p className="text-xs leading-relaxed text-[hsl(216_20%_60%)]">
            <span className="font-semibold">Recommendation:</span> {risk.recommendation}
          </p>
        </div>
        {citationWarning && !citationWarning.verified && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-500/5 border border-red-500/20 p-2.5">
            <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-xs leading-relaxed text-red-300">
              <span className="font-semibold">Citation Alert:</span> {citationWarning.reason}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CitationWarningCard({ warning }: { warning: CitationWarning }) {
  const isUnverified = !warning.verified;
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-lg border p-3',
      isUnverified
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-amber-500/30 bg-amber-500/5'
    )}>
      {isUnverified ? (
        <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
      ) : (
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-[hsl(214_100%_97%)]">{warning.raw}</span>
          <Badge className={cn(
            'text-[10px]',
            isUnverified ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
          )}>
            {isUnverified ? 'Not Found' : 'Partial Match'}
          </Badge>
        </div>
        <p className="text-xs text-[hsl(216_20%_65%)]">{warning.reason}</p>
      </div>
    </div>
  );
}

interface ReviewResultsPanelProps {
  result: ReviewResult;
  draftText?: string;
  hasFixesApplied?: boolean;
  onApplyFixes?: (selectedFixes: SelectedFixes) => void;
  onExport?: (format: 'docx' | 'pdf', fixedDraft: string) => void;
  onReanalyze?: () => void;
  isApplying?: boolean;
}

export interface SelectedFixes {
  structuralIssues: number[];
  missingSections: number[];
  risks: number[];
  citationWarnings: number[];
}

export function ReviewResultsPanel({ result, draftText, hasFixesApplied, onApplyFixes, onExport, onReanalyze, isApplying }: ReviewResultsPanelProps) {
  const [selected, setSelected] = useState<SelectedFixes>({
    structuralIssues: [],
    missingSections: [],
    risks: [],
    citationWarnings: [],
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  // Apply timer state
  const [applyElapsed, setApplyElapsed] = useState(0);
  const [applyTimerActive, setApplyTimerActive] = useState(false);

  useEffect(() => {
    if (isApplying && !applyTimerActive) {
      setApplyElapsed(0);
      setApplyTimerActive(true);
    } else if (!isApplying && applyTimerActive) {
      setApplyTimerActive(false);
    }
  }, [isApplying, applyTimerActive]);

  useEffect(() => {
    if (!applyTimerActive) return;
    const id = setInterval(() => setApplyElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [applyTimerActive]);

  const formatApplyTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Build a map from section to citation warning for cross-referencing
  const warningBySection = new Map<string, CitationWarning>();
  if (result.citationWarnings) {
    for (const w of result.citationWarnings) {
      warningBySection.set(w.section, w);
    }
  }

  const totalFixable =
    result.structuralIssues.length +
    result.missingSections.length +
    result.risks.length +
    (result.citationWarnings?.length || 0);

  const totalSelected =
    selected.structuralIssues.length +
    selected.missingSections.length +
    selected.risks.length +
    selected.citationWarnings.length;

  const toggleItem = (category: keyof SelectedFixes, index: number) => {
    setSelected((prev) => {
      const arr = prev[category];
      const next = arr.includes(index) ? arr.filter((i) => i !== index) : [...arr, index];
      return { ...prev, [category]: next };
    });
  };

  const toggleAll = () => {
    if (selectAll) {
      setSelected({ structuralIssues: [], missingSections: [], risks: [], citationWarnings: [] });
      setSelectAll(false);
    } else {
      setSelected({
        structuralIssues: result.structuralIssues.map((_, i) => i),
        missingSections: result.missingSections.map((_, i) => i),
        risks: result.risks.map((_, i) => i),
        citationWarnings: (result.citationWarnings || []).map((_, i) => i),
      });
      setSelectAll(true);
    }
  };

  const handleApply = () => {
    if (onApplyFixes && totalSelected > 0) {
      onApplyFixes(selected);
    }
  };

  const Checkbox = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors mt-0.5',
        checked
          ? 'border-[hsl(158_64%_45%)] bg-[hsl(158_64%_45%)] text-white'
          : 'border-[hsl(224_27%_30%)] bg-transparent hover:border-[hsl(158_64%_45%/0.5)]'
      )}
    >
      {checked && <CheckCircle2 className="h-3 w-3" />}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <ScoreDisplay score={result.overallScore} />
        <div className="md:col-span-2 space-y-2">
          <h4 className="text-sm font-semibold text-[hsl(216_20%_65%)]">Summary</h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              { count: result.risks.length, label: 'Compliance Risks' },
              { count: result.structuralIssues.length, label: 'Structural Issues' },
              { count: result.missingSections.length, label: 'Missing Sections' },
            ].map(({ count, label }) => (
              <div key={label} className="rounded-lg border border-[hsl(224_27%_22%)] bg-[hsl(224_35%_17%)] p-3 text-center">
                <span className="block text-lg font-bold text-[hsl(214_100%_97%)]">{count}</span>
                <span className="text-xs text-[hsl(216_20%_50%)]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Select All toggle */}
      {totalFixable > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-[hsl(224_27%_22%)] bg-[hsl(224_35%_13%)] px-4 py-2.5">
          <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-[hsl(216_20%_65%)] hover:text-white transition-colors">
            <Checkbox checked={selectAll} onChange={toggleAll} />
            Select all issues to fix ({totalSelected}/{totalFixable})
          </button>
        </div>
      )}

      {/* Citation Warnings section */}
      {result.citationWarnings && result.citationWarnings.length > 0 && (
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-400">
            <ShieldX className="h-4 w-4" />Citation Warnings ({result.citationWarnings.length})
          </h4>
          <div className="space-y-2">
            {result.citationWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <Checkbox
                  checked={selected.citationWarnings.includes(i)}
                  onChange={() => toggleItem('citationWarnings', i)}
                />
                <div className="flex-1">
                  <CitationWarningCard warning={w} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-[hsl(216_20%_50%)]">
            These citations could not be verified against the legal database. They may be hallucinated or incorrect.
          </p>
        </div>
      )}

      {result.risks.length > 0 && (
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(216_20%_65%)]">
            <AlertTriangle className="h-4 w-4 text-[hsl(38_95%_55%)]" />Compliance Risks
          </h4>
          <div className="space-y-3">{result.risks.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <Checkbox
                checked={selected.risks.includes(i)}
                onChange={() => toggleItem('risks', i)}
              />
              <div className="flex-1">
                <RiskCard risk={r} citationWarning={warningBySection.get(r.section)} />
              </div>
            </div>
          ))}</div>
        </div>
      )}

      {result.structuralIssues.length > 0 && (
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(216_20%_65%)]">
            <XCircle className="h-4 w-4 text-red-400" />Structural Issues
          </h4>
          <ul className="space-y-2">
            {result.structuralIssues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-[hsl(224_27%_22%)] bg-[hsl(224_35%_17%)] p-3 text-sm text-[hsl(214_100%_97%)]">
                <Checkbox
                  checked={selected.structuralIssues.includes(i)}
                  onChange={() => toggleItem('structuralIssues', i)}
                />
                <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.missingSections.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-[hsl(216_20%_65%)]">Missing Sections</h4>
          <div className="flex flex-wrap gap-2">
            {result.missingSections.map((s, i) => (
              <button
                key={i}
                onClick={() => toggleItem('missingSections', i)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                  selected.missingSections.includes(i)
                    ? 'border-[hsl(158_64%_45%)] bg-[hsl(158_64%_45%/0.15)] text-[hsl(158_64%_70%)]'
                    : 'border-[hsl(224_27%_25%)] bg-[hsl(224_35%_17%)] text-[hsl(214_100%_97%)] hover:border-[hsl(158_64%_45%/0.5)]'
                )}
              >
                {selected.missingSections.includes(i) && <CheckCircle2 className="h-3 w-3" />}
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {/* Apply Selected Fixes */}
        {totalFixable > 0 && onApplyFixes && (
          <div className="flex items-center gap-3">
            <Button
              onClick={handleApply}
              disabled={totalSelected === 0 || isApplying}
              className="gap-2 bg-[hsl(158_64%_45%)] text-white hover:bg-[hsl(158_64%_37%)] disabled:opacity-50"
            >
              {isApplying ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Applying Fixes...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" />Apply Selected Fixes ({totalSelected})</>
              )}
            </Button>
            {applyTimerActive && (
              <span className="flex items-center gap-1.5 text-sm font-mono text-[hsl(158_64%_60%)]">
                <span className="h-2 w-2 rounded-full bg-[hsl(158_64%_50%)] animate-pulse" />
                {formatApplyTime(applyElapsed)}
              </span>
            )}
            {!applyTimerActive && applyElapsed > 0 && (
              <span className="text-xs text-[hsl(216_20%_45%)]">
                Completed in {formatApplyTime(applyElapsed)}
              </span>
            )}
          </div>
        )}

        {/* Export Draft / Export Fixed Draft */}
        <Button
          variant="outline"
          onClick={() => setShowExportModal(true)}
          className="gap-2 border-[hsl(224_27%_25%)] text-[hsl(216_20%_65%)] hover:text-white hover:border-[hsl(158_64%_45%/0.5)]"
        >
          <Download className="h-4 w-4" />
          {hasFixesApplied ? 'Export Fixed Draft' : 'Export Original Draft'}
        </Button>

        {/* Export Report */}
        <Button variant="outline" onClick={() => {}} className="gap-2 border-[hsl(224_27%_25%)] text-[hsl(216_20%_65%)] hover:text-white hover:border-[hsl(239_84%_67%)]">
          <Download className="h-4 w-4" />Export Report
        </Button>
      </div>

      {/* ── Export Modal ──────────────────────────────────────────────────── */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-[hsl(224_27%_25%)] bg-[hsl(222_47%_9%)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-[hsl(214_100%_97%)]">Export</h3>
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                  hasFixesApplied
                    ? 'bg-[hsl(158_64%_45%/0.2)] text-[hsl(158_64%_70%)]'
                    : 'bg-[hsl(224_27%_22%)] text-[hsl(216_20%_55%)]'
                )}>
                  {hasFixesApplied ? 'Fixed Draft' : 'Original Draft'}
                </span>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="rounded-lg p-1.5 text-[hsl(216_20%_55%)] hover:bg-[hsl(224_27%_22%)] hover:text-white transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            {/* Fixes applied banner */}
            {hasFixesApplied && (
              <div className="mb-4 rounded-lg border border-[hsl(158_64%_45%/0.3)] bg-[hsl(158_64%_45%/0.08)] p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(158_64%_60%)]" />
                  <div>
                    <p className="text-sm font-medium text-[hsl(158_64%_80%)]">
                      Selected fixes have been applied to this draft.
                    </p>
                    <p className="mt-1 text-xs text-[hsl(158_64%_60%)]">
                      The compliance score above reflects the pre-fix analysis. You may want to re-analyze after exporting to get an updated score.
                    </p>
                    {onReanalyze && (
                      <button
                        onClick={() => { setShowExportModal(false); onReanalyze(); }}
                        className="mt-2 rounded-lg bg-[hsl(158_64%_45%/0.2)] px-3 py-1.5 text-xs font-medium text-[hsl(158_64%_70%)] hover:bg-[hsl(158_64%_45%/0.3)] transition-colors"
                      >
                        Re-analyze for updated score
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Preview section */}
            <div className="mb-5">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">
                Preview — {hasFixesApplied ? 'Fixed Draft' : 'Original Draft'}
              </h4>
              <div className="max-h-48 overflow-auto rounded-lg border border-[hsl(224_27%_22%)] bg-[hsl(224_35%_13%)] p-4 font-mono text-xs text-[hsl(214_100%_90%)] leading-relaxed whitespace-pre-wrap">
                {draftText?.substring(0, 1000) || 'No draft text available.'}
                {(draftText?.length || 0) > 1000 && '\n\n... (truncated for preview)'}
              </div>
            </div>

            {/* Format selection */}
            <div className="mb-5">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">Export Format</h4>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    if (onExport && draftText) onExport('docx', draftText);
                    setShowExportModal(false);
                  }}
                  className="flex flex-col items-center gap-2 rounded-xl border border-[hsl(224_27%_25%)] bg-[hsl(224_35%_13%)] p-4 transition-all hover:border-[hsl(158_64%_45%/0.5)] hover:bg-[hsl(224_35%_17%)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                    <Download className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-[hsl(214_100%_97%)]">DOCX</span>
                  <span className="text-[10px] text-[hsl(216_20%_50%)]">Microsoft Word</span>
                </button>
                <button
                  onClick={() => {
                    if (onExport && draftText) onExport('pdf', draftText);
                    setShowExportModal(false);
                  }}
                  className="flex flex-col items-center gap-2 rounded-xl border border-[hsl(224_27%_25%)] bg-[hsl(224_35%_13%)] p-4 transition-all hover:border-[hsl(158_64%_45%/0.5)] hover:bg-[hsl(224_35%_17%)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                    <Download className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-[hsl(214_100%_97%)]">PDF</span>
                  <span className="text-[10px] text-[hsl(216_20%_50%)]">Portable Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DraftWizardProps {
  participantName?: string | null;
}

export default function DraftWizard({ participantName }: DraftWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<OrdTemplateType | null>(null);
  const [draftDetails, setDraftDetails] = useState<DraftDetails>({ title: '', subjectMatter: '', keyProvisions: '', targetArea: '' });
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [draftCitationWarnings, setDraftCitationWarnings] = useState<CitationWarning[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isApplyingFixes, setIsApplyingFixes] = useState(false);
  const [hasFixesApplied, setHasFixesApplied] = useState(false);

  const canAdvance = (): boolean => {
    switch (currentStep) {
      case 1: return selectedTemplate !== null;
      case 2: return draftDetails.title.trim() !== '' && draftDetails.subjectMatter.trim() !== '' && draftDetails.keyProvisions.trim() !== '' && draftDetails.targetArea.trim() !== '';
      case 3: return generatedDraft.trim() !== '';
      case 4: return reviewResult !== null;
      default: return false;
    }
  };

  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/obra/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: selectedTemplate, details: draftDetails, participantName: participantName || undefined, sessionId: getOrCreateSessionId() }),
      });
      const data = await response.json();
      setGeneratedDraft(data.draft);
      setDraftCitationWarnings(data.citationWarnings || []);
    } catch { /* handle silently */ }
    finally { setIsGenerating(false); }
  };

  const handleReviewCompliance = async () => {
    setIsReviewing(true);
    try {
      const response = await fetch('/api/obra/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: generatedDraft, participantName: participantName || undefined, sessionId: getOrCreateSessionId() }),
      });
      const data: ReviewResult = await response.json();
      setReviewResult(data);
    } catch { /* handle silently */ }
    finally { setIsReviewing(false); }
  };

  const handleApplyFixes = async (selectedFixes: SelectedFixes) => {
    if (!reviewResult || !generatedDraft.trim()) return;
    setIsApplyingFixes(true);
    try {
      const response = await fetch('/api/obra/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: generatedDraft,
          selectedFixes,
          reviewResult: {
            structuralIssues: reviewResult.structuralIssues,
            missingSections: reviewResult.missingSections,
            risks: reviewResult.risks,
            citationWarnings: reviewResult.citationWarnings,
          },
          participantName: participantName || undefined,
          sessionId: getOrCreateSessionId(),
        }),
      });
      const data = await response.json();
      if (data.draft) {
        setGeneratedDraft(data.draft);
        setHasFixesApplied(true);
      }
    } catch { /* handle silently */ }
    finally { setIsApplyingFixes(false); }
  };

  const handleExportDraft = (format: 'docx' | 'pdf', text: string) => {
    const title = extractTitle(text);
    if (format === 'docx') {
      exportAsDocx(text, title);
    } else {
      exportAsPdf(text, title);
    }
  };

  const labelClass = 'mb-1.5 block text-sm font-medium text-[hsl(216_20%_65%)]';
  const emptyStateClass = 'flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[hsl(224_27%_25%)] py-10';

  return (
    <div className="mx-auto max-w-4xl py-3">
      <StepIndicator currentStep={currentStep} />
      <div>
        {currentStep === 1 && (
          <div>
            <h3 className="mb-1 text-lg font-semibold text-[hsl(214_100%_97%)]">Choose Ordinance Template</h3>
            <p className="mb-6 text-sm text-[hsl(216_20%_55%)]">Select the type of ordinance you want to draft.</p>
            <TemplatePicker onSelect={setSelectedTemplate} selected={selectedTemplate} />
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <h3 className="mb-1 text-lg font-semibold text-[hsl(214_100%_97%)]">Ordinance Details</h3>
            <p className="mb-6 text-sm text-[hsl(216_20%_55%)]">Provide the key details for your {selectedTemplate && selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)} Ordinance.</p>
            <div className="space-y-5">
              <div><label className={labelClass}>Title</label><Input placeholder="e.g., An Ordinance Imposing a Municipal Tax on..." value={draftDetails.title} onChange={e => setDraftDetails(d => ({ ...d, title: e.target.value }))} className="bg-[hsl(224_35%_17%)] border-[hsl(224_27%_25%)] text-[hsl(214_100%_97%)] placeholder:text-[hsl(216_20%_40%)] focus:border-[hsl(158_64%_45%)]" /></div>
              <div><label className={labelClass}>Subject Matter</label><Input placeholder="e.g., Regulation of commercial establishments in the public market" value={draftDetails.subjectMatter} onChange={e => setDraftDetails(d => ({ ...d, subjectMatter: e.target.value }))} className="bg-[hsl(224_35%_17%)] border-[hsl(224_27%_25%)] text-[hsl(214_100%_97%)] placeholder:text-[hsl(216_20%_40%)] focus:border-[hsl(158_64%_45%)]" /></div>
              <div><label className={labelClass}>Key Provisions</label><Textarea placeholder="Describe the main provisions, rules, or measures to include..." rows={4} value={draftDetails.keyProvisions} onChange={e => setDraftDetails(d => ({ ...d, keyProvisions: e.target.value }))} className="bg-[hsl(224_35%_17%)] border-[hsl(224_27%_25%)] text-[hsl(214_100%_97%)] placeholder:text-[hsl(216_20%_40%)] focus:border-[hsl(158_64%_45%)]" /></div>
              <div><label className={labelClass}>Target Area</label><Input placeholder="e.g., Municipality of Pitogo, Quezon" value={draftDetails.targetArea} onChange={e => setDraftDetails(d => ({ ...d, targetArea: e.target.value }))} className="bg-[hsl(224_35%_17%)] border-[hsl(224_27%_25%)] text-[hsl(214_100%_97%)] placeholder:text-[hsl(216_20%_40%)] focus:border-[hsl(158_64%_45%)]" /></div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h3 className="mb-1 text-lg font-semibold text-[hsl(214_100%_97%)]">Generated Draft</h3>
            <p className="mb-6 text-sm text-[hsl(216_20%_55%)]">Review the AI-generated ordinance draft below.</p>
            {!generatedDraft && !isGenerating && (
              <div className={emptyStateClass}>
                <p className="mb-4 text-sm text-[hsl(216_20%_55%)]">Click the button below to generate your ordinance draft.</p>
                <Button onClick={handleGenerateDraft} className="gap-2 bg-[hsl(158_64%_45%)] text-white hover:bg-[hsl(158_64%_37%)]">Generate Draft</Button>
              </div>
            )}
            {isGenerating && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-[hsl(224_27%_22%)] bg-[hsl(224_35%_17%)] py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[hsl(158_64%_50%)]" />
                <p className="mt-3 text-sm font-medium text-[hsl(214_100%_97%)]">Generating your ordinance draft...</p>
                <p className="mt-1 text-xs text-[hsl(216_20%_50%)]">This may take a few moments</p>
              </div>
            )}
            {generatedDraft && !isGenerating && (
              <div className="space-y-4">
                {/* Citation warnings for draft */}
                {draftCitationWarnings.length > 0 && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-400">
                      <ShieldX className="h-4 w-4" />Citation Warnings ({draftCitationWarnings.length})
                    </h4>
                    <p className="mb-3 text-xs text-[hsl(216_20%_55%)]">
                      The following citations in the draft could not be verified against the legal database.
                    </p>
                    <div className="space-y-2">
                      {draftCitationWarnings.map((w, i) => (
                        <CitationWarningCard key={i} warning={w} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="max-h-[500px] overflow-y-auto rounded-xl border border-[hsl(224_27%_22%)] bg-[hsl(224_35%_17%)] p-8">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-[hsl(214_100%_90%)]" style={{ fontFamily: "'Georgia', serif" }}>{generatedDraft}</div>
                </div>
                <Button variant="outline" onClick={handleGenerateDraft} className="gap-2 border-[hsl(224_27%_25%)] text-[hsl(216_20%_65%)]">
                  <Loader2 className="h-4 w-4" />Regenerate
                </Button>
              </div>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <h3 className="mb-1 text-lg font-semibold text-[hsl(214_100%_97%)]">Compliance Review</h3>
            <p className="mb-6 text-sm text-[hsl(216_20%_55%)]">Review the ordinance draft for compliance with R.A. 7160.</p>
            {!reviewResult && !isReviewing && (
              <div className={emptyStateClass}>
                <p className="mb-4 text-sm text-[hsl(216_20%_55%)]">Analyze your draft for legal compliance and structural issues.</p>
                <Button onClick={handleReviewCompliance} className="gap-2 bg-[hsl(158_64%_45%)] text-white hover:bg-[hsl(158_64%_37%)]">Review Compliance</Button>
              </div>
            )}
            {isReviewing && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-[hsl(224_27%_22%)] bg-[hsl(224_35%_17%)] py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[hsl(158_64%_50%)]" />
                <p className="mt-3 text-sm font-medium text-[hsl(214_100%_97%)]">Analyzing compliance with R.A. 7160...</p>
                <p className="mt-1 text-xs text-[hsl(216_20%_50%)]">Checking legal basis, structure, and potential risks</p>
              </div>
            )}
            {reviewResult && !isReviewing && (
              <ReviewResultsPanel
                result={reviewResult}
                draftText={generatedDraft}
                hasFixesApplied={hasFixesApplied}
                onApplyFixes={handleApplyFixes}
                onExport={handleExportDraft}
                onReanalyze={handleReviewCompliance}
                isApplying={isApplyingFixes}
              />
            )}
          </div>
        )}
      </div>

      <Separator className="my-6 bg-[hsl(224_27%_22%)]" />
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(s => Math.max(1, s - 1))} disabled={currentStep === 1} className="gap-1 border-[hsl(224_27%_25%)] text-[hsl(216_20%_65%)] hover:text-white">
          <ChevronLeft className="h-4 w-4" />Back
        </Button>
        {currentStep < 4 && (
          <Button onClick={() => setCurrentStep(s => Math.min(4, s + 1))} disabled={!canAdvance()} className="gap-1 bg-[hsl(158_64%_45%)] text-white hover:bg-[hsl(158_64%_37%)] disabled:opacity-40">
            Next<ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
