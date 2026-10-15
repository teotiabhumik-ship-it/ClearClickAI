import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  Lightbulb,
  ExternalLink,
  SlidersHorizontal,
  ChevronRight,
  Info,
  Cpu,
  Sparkles
} from 'lucide-react';
import { Finding, CategoryType } from '../types';

interface FindingsPanelProps {
  findings: Finding[];
  summaryByCategory: Record<CategoryType, number>;
  selectedFindingIndex: number | null;
  onSelectFinding: (idx: number) => void;
  disclaimer: string;
  aiStatus?: 'not_run' | 'completed' | 'failed';
  aiStatusMessage?: string;
  ruleFindingsCount?: number;
  aiFindingsCount?: number;
}

interface PlainEnglishInfo {
  title: string;
  simpleExplanation: string;
  whatToDo: string;
}

const PLAIN_ENGLISH_INFO: Record<string, PlainEnglishInfo> = {
  unequal_button_emphasis: {
    title: 'Unequal Choice Buttons',
    simpleExplanation: 'The website makes "Accept All" bright and colorful, while hiding "Reject" as a faint, tiny text link so you click agree without realizing your choices.',
    whatToDo: 'Look closely for a faint gray text link (like "Reject", "Decline", or "Manage Options") before clicking the bright primary button.'
  },
  preticked_consent: {
    title: 'Pre-Checked Permission Box',
    simpleExplanation: 'A checkbox granting permission for tracking, emails, or optional features was already turned ON for you before you touched it.',
    whatToDo: 'Uncheck the pre-ticked box before clicking Next or Submit if you do not want to share data or receive marketing.'
  },
  missing_reject_option: {
    title: 'Missing "Reject" Button',
    simpleExplanation: 'The popup gives you an instant one-click "Accept" button, but no equal one-click "Reject" button, forcing you through deep settings to decline.',
    whatToDo: 'Click "Cookie Settings" or "Preferences" to turn off tracking cookies manually.'
  },
  double_negative_language: {
    title: 'Confusing Double-Negative Wording',
    simpleExplanation: 'The text uses confusing reverse language (like "Uncheck if you do not wish to not receive...") designed to trick you into choosing what the site wants.',
    whatToDo: 'Re-read the checkbox sentence carefully to verify whether leaving it checked or unchecked gives you the outcome you want.'
  },
  drip_pricing: {
    title: 'Surprise Fee Added at Checkout',
    simpleExplanation: 'The site advertised a low initial price, but sneakily added unexpected mandatory fees, resort charges, or service surcharges right at the last step.',
    whatToDo: 'Check the final price breakdown line-by-line before typing payment details. Compare the total against the first advertised price.'
  },
  microprint_fee: {
    title: 'Fee Hidden in Tiny Print',
    simpleExplanation: 'Important subscription renewal terms or mandatory extra fees are displayed in tiny, hard-to-read font at the bottom of the page.',
    whatToDo: 'Zoom in or scan the small text right under the price to check if there are recurring charges or automatic renewals.'
  },
  low_contrast_fee: {
    title: 'Faint / Low-Contrast Fee Text',
    simpleExplanation: 'Important fee disclosures are written in faint gray text that blends into the background, making them easy to miss.',
    whatToDo: 'Inspect the muted text near the price or total. Highlight it with your mouse to read any hidden fee conditions.'
  },
  bundled_hidden_fee: {
    title: 'Sneaky Pre-Selected Fee',
    simpleExplanation: 'An optional paid add-on (such as insurance, expedited handling, or a tip) was automatically slipped into your cart without your request.',
    whatToDo: 'Look through your cart items and remove any pre-added extras before completing payment.'
  },
  buried_cancel_link: {
    title: 'Hidden Cancellation Link',
    simpleExplanation: 'The button or link to cancel your subscription or close your account is hidden deep inside menus or disguised as faint text.',
    whatToDo: 'Look inside Account > Billing or Settings. Use your browser search (Ctrl+F) for the word "cancel" or "manage subscription".'
  },
  confirm_shaming: {
    title: 'Guilt-Trip Button Phrasing',
    simpleExplanation: 'The button to decline an offer tries to make you feel guilty or foolish (e.g., "No thanks, I hate saving money" or "I prefer paying full price").',
    whatToDo: 'Ignore the emotional guilt-trip. Click the decline option with confidence if you do not want the offer.'
  },
  asymmetric_cancellation_steps: {
    title: 'Multi-Step Cancellation Maze',
    simpleExplanation: 'Signing up was quick in 1 click, but cancelling forces you through multiple screens, warnings, offers, or phone call demands.',
    whatToDo: 'Keep clicking through the cancellation steps until you reach the final screen and receive a confirmation email.'
  },
  obscured_charge_visual: {
    title: 'Visually Obscured Price Terms',
    simpleExplanation: 'Crucial payment terms or recurring billing details are washed out or placed outside the normal reading area.',
    whatToDo: 'Read all text surrounding the checkout button before confirming your purchase.'
  },
  visual_cancellation_obstacle: {
    title: 'Deceptive Cancellation Screen',
    simpleExplanation: 'The cancellation screen makes "Keep My Subscription" look big and inviting while making the actual cancellation button look gray or disabled.',
    whatToDo: 'Look for the muted secondary button that actually proceeds with cancellation.'
  }
};

function getPlainEnglish(type: string): PlainEnglishInfo {
  if (PLAIN_ENGLISH_INFO[type]) {
    return PLAIN_ENGLISH_INFO[type];
  }
  const cleanTitle = type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: cleanTitle,
    simpleExplanation: 'The design or text of this element may steer you toward a choice that benefits the website rather than you.',
    whatToDo: 'Inspect this element carefully before clicking or confirming.'
  };
}

export const FindingsPanel: React.FC<FindingsPanelProps> = ({
  findings,
  summaryByCategory,
  selectedFindingIndex,
  onSelectFinding,
  disclaimer,
  aiStatus = 'not_run',
  aiStatusMessage,
  ruleFindingsCount,
  aiFindingsCount,
}) => {
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('simple');
  const [filterCategory, setFilterCategory] = useState<CategoryType | 'all'>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'rule' | 'ai'>('all');

  const ruleCount = ruleFindingsCount ?? findings.filter((f) => f.source === 'rule').length;
  const aiCount = aiFindingsCount ?? findings.filter((f) => f.source === 'ai').length;

  const filteredFindings = findings
    .map((f, originalIndex) => ({ ...f, originalIndex }))
    .filter((f) => filterCategory === 'all' || f.category === filterCategory)
    .filter((f) => filterSource === 'all' || f.source === filterSource);

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'high':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[11px] font-medium uppercase">{viewMode === 'simple' ? 'High Impact' : 'High Severity'}</span>;
      case 'medium':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[11px] font-medium uppercase">{viewMode === 'simple' ? 'Moderate' : 'Medium'}</span>;
      case 'low':
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[11px] font-medium uppercase">{viewMode === 'simple' ? 'Minor Notice' : 'Low'}</span>;
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
      {/* Category Breakdown Header */}
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

        {/* AI Status Banner */}
        {aiStatus === 'not_run' && (
          <div className="mt-3 p-2 bg-slate-900/90 border border-amber-500/30 rounded-lg flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="font-semibold text-amber-300">AI analysis not run</span>
              <span className="text-slate-400">— No API key set. Showing rule detections only.</span>
            </div>
          </div>
        )}
        {aiStatus === 'failed' && (
          <div className="mt-3 p-2 bg-rose-950/40 border border-rose-500/30 rounded-lg flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span className="font-semibold text-rose-300">AI analysis failed</span>
              <span className="text-slate-400">— {aiStatusMessage || 'API call failed'}. Rule-only findings.</span>
            </div>
          </div>
        )}
        {aiStatus === 'completed' && (
          <div className="mt-3 p-2 bg-purple-950/40 border border-purple-500/30 rounded-lg flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="font-semibold text-purple-200">AI analysis completed</span>
              <span className="text-purple-300">— {aiCount} AI finding{aiCount !== 1 ? 's' : ''} verified against page</span>
            </div>
          </div>
        )}

        {/* Source Filter Tabs: All / Rule-Only / AI */}
        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800/80">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Source:</span>
          <button
            onClick={() => setFilterSource('all')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
              filterSource === 'all'
                ? 'bg-blue-600 text-white font-semibold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All ({findings.length})
          </button>
          <button
            onClick={() => setFilterSource('rule')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
              filterSource === 'rule'
                ? 'bg-cyan-700 text-white font-semibold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Rules Only ({ruleCount})
          </button>
          <button
            onClick={() => setFilterSource('ai')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
              filterSource === 'ai'
                ? 'bg-purple-700 text-white font-semibold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            AI ({aiCount})
          </button>
        </div>

        {/* View Mode Toggle: Plain English vs Detailed Audit */}
        <div className="mt-3 flex items-center justify-between p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200">View Mode:</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              {viewMode === 'simple' ? 'Simple explanations for everyday users' : 'Full technical metrics & developer proof'}
            </span>
          </div>
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('simple')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'simple'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Plain English</span>
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'detailed'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-300" />
              <span>Detailed Audit</span>
            </button>
          </div>
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
            const plainInfo = getPlainEnglish(finding.type);

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
                {viewMode === 'simple' ? (
                  <>
                    {/* Plain English Header */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{plainInfo.title}</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono capitalize">
                          {finding.category.replace('_', ' ')} Pattern
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getSeverityBadge(finding.severity)}
                      </div>
                    </div>

                    {/* What this website is doing */}
                    <div className="text-xs text-slate-200 leading-relaxed mb-3 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-amber-400 font-semibold block text-[11px] uppercase tracking-wider mb-1">
                        What this website is doing:
                      </span>
                      <p className="text-slate-300 leading-relaxed">{plainInfo.simpleExplanation}</p>
                    </div>

                    {/* Where we found it on screen */}
                    <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-xs mb-3">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold tracking-wider mb-1">
                        Where we found it on page:
                      </span>
                      <span className="text-blue-300 font-mono text-[11px] break-words">{finding.evidence}</span>
                    </div>

                    {/* What you should do */}
                    <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px] mb-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>What you should do:</span>
                      </div>
                      <p className="text-emerald-200/95 leading-relaxed text-[11px]">
                        {plainInfo.whatToDo}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
