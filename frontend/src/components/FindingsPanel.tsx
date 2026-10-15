import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  Lightbulb,
  ExternalLink,
  SlidersHorizontal,
  ChevronRight,
  Info
} from 'lucide-react';
import { Finding, CategoryType } from '../types';

interface FindingsPanelProps {
  findings: Finding[];
  summaryByCategory: Record<CategoryType, number>;
  selectedFindingIndex: number | null;
  onSelectFinding: (idx: number) => void;
  disclaimer: string;
}

export const FindingsPanel: React.FC<FindingsPanelProps> = ({
  findings,
  summaryByCategory,
  selectedFindingIndex,
  onSelectFinding,
  disclaimer,
}) => {
  const [filterCategory, setFilterCategory] = useState<CategoryType | 'all'>('all');

  const filteredFindings = findings
    .map((f, originalIndex) => ({ ...f, originalIndex }))
    .filter((f) => filterCategory === 'all' || f.category === filterCategory);

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'high':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[11px] font-medium uppercase">High Severity</span>;
      case 'medium':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[11px] font-medium uppercase">Medium</span>;
      case 'low':
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[11px] font-medium uppercase">Low</span>;
      default:
        return null;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'rule':
        return <span className="bg-slate-800 text-cyan-300 border border-cyan-800/50 px-1.5 py-0.5 rounded text-[10px] font-mono">RULE DETECTOR</span>;
      case 'ai':
        return <span className="bg-purple-950/60 text-purple-300 border border-purple-700/50 px-1.5 py-0.5 rounded text-[10px] font-mono">AI INSPECTION</span>;
      default:
        return <span className="bg-indigo-950/60 text-indigo-300 border border-indigo-700/50 px-1.5 py-0.5 rounded text-[10px] font-mono">HYBRID</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-full shadow-xl overflow-hidden">
      {/* Category Breakdown Header (No single verdict score!) */}
      <div className="p-4 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
            <span>Category Breakdown</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {findings.length} Finding{findings.length !== 1 ? 's' : ''} Emitted
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setFilterCategory(filterCategory === 'consent' ? 'all' : 'consent')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              filterCategory === 'consent'
                ? 'bg-blue-950/60 border-blue-500 shadow-sm'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] text-slate-400 font-medium">Manipulative Consent</div>
            <div className="text-lg font-bold text-white mt-0.5">{summaryByCategory.consent || 0}</div>
          </button>

          <button
            onClick={() => setFilterCategory(filterCategory === 'hidden_charges' ? 'all' : 'hidden_charges')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              filterCategory === 'hidden_charges'
                ? 'bg-blue-950/60 border-blue-500 shadow-sm'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] text-slate-400 font-medium">Hidden Charges</div>
            <div className="text-lg font-bold text-white mt-0.5">{summaryByCategory.hidden_charges || 0}</div>
          </button>

          <button
            onClick={() => setFilterCategory(filterCategory === 'cancellation' ? 'all' : 'cancellation')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              filterCategory === 'cancellation'
                ? 'bg-blue-950/60 border-blue-500 shadow-sm'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] text-slate-400 font-medium">Cancellation Friction</div>
            <div className="text-lg font-bold text-white mt-0.5">{summaryByCategory.cancellation || 0}</div>
          </button>
        </div>

        {/* Fixed Neutral Disclaimer */}
        <div className="mt-3 p-2 bg-slate-900/90 border border-slate-800/80 rounded flex items-start gap-2 text-[11px] text-slate-400">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <span>{disclaimer}</span>
        </div>
      </div>

      {/* Findings List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredFindings.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <CheckCircle className="w-12 h-12 text-emerald-500/80 mb-2" />
            <h4 className="text-sm font-semibold text-slate-200">No Potential Deceptive Patterns Detected</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              The page complies with transparent design standards across the evaluated focus areas.
            </p>
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const isSelected = selectedFindingIndex === finding.originalIndex;
            return (
              <div
                key={finding.originalIndex}
                onClick={() => onSelectFinding(finding.originalIndex)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/90 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-white tracking-wide">
                      {finding.type}
                    </span>
                    {getSourceBadge(finding.source)}
                  </div>
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(finding.severity)}
                    <span className="text-[10px] text-slate-500 font-mono">
                      {Math.round(finding.confidence * 100)}% conf
                    </span>
                  </div>
                </div>

                {/* Explanation */}
                <div className="text-xs text-slate-300 leading-relaxed mb-3">
                  <strong className="text-slate-400 font-medium">Why it may mislead: </strong>
                  {finding.why}
                </div>

                {/* Evidence */}
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 mb-3 break-words">
                  <span className="text-slate-500 block text-[10px] uppercase font-sans mb-1 font-semibold tracking-wider">
                    Measured Proof / Quote:
                  </span>
                  <span className="text-amber-300 font-medium">{finding.evidence}</span>
                </div>

                {/* Safer Alternative */}
                <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px] mb-1">
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Safer Design Recommendation</span>
                  </div>
                  <div className="text-emerald-200/90 leading-relaxed text-[11px]">
                    {finding.safer_alternative}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
