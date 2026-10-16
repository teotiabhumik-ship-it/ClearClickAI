import React, { useState } from 'react';
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
        return (
          <span className="bg-error-container text-on-error-container border border-error/30 px-2 py-0.5 rounded text-[11px] font-semibold uppercase">
            {viewMode === 'simple' ? 'Serious' : 'High Severity'}
          </span>
        );
      case 'medium':
        return (
          <span className="bg-secondary-fixed text-on-secondary-fixed border border-secondary/30 px-2 py-0.5 rounded text-[11px] font-semibold uppercase">
            {viewMode === 'simple' ? 'Caution' : 'Medium'}
          </span>
        );
      case 'low':
        return (
          <span className="bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary/30 px-2 py-0.5 rounded text-[11px] font-semibold uppercase">
            {viewMode === 'simple' ? 'Notice' : 'Low'}
          </span>
        );
      default:
        return null;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'rule':
        return <span className="bg-surface-container text-on-surface-variant border border-outline-variant/40 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium">RULE ENGINE</span>;
      case 'ai':
        return <span className="bg-primary-fixed/40 text-primary border border-primary/40 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold">AI INSPECTION</span>;
      default:
        return <span className="bg-surface-container-high text-on-surface px-1.5 py-0.5 rounded text-[10px] font-mono font-medium">HYBRID</span>;
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl flex flex-col h-full shadow-[0px_1px_3px_rgba(15,23,42,0.04)] overflow-hidden min-h-[540px]">
      {/* Category Breakdown Header */}
      <div className="p-4 bg-surface-container-low border-b border-outline-variant/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
            <span>Category Breakdown</span>
          </h3>
          <span className="text-xs font-mono text-on-surface-variant font-medium">
            {findings.length} Finding{findings.length !== 1 ? 's' : ''} Emitted
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setFilterCategory(filterCategory === 'consent' ? 'all' : 'consent')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              filterCategory === 'consent'
                ? 'bg-primary-fixed/30 border-primary-container shadow-2xs'
                : 'bg-surface-container-lowest border-outline-variant/30 hover:border-outline'
            }`}
          >
            <div className="text-[11px] text-on-surface-variant font-medium">Consent</div>
            <div className="text-lg font-bold text-on-surface mt-0.5">{summaryByCategory.consent || 0}</div>
          </button>

          <button
            type="button"
            onClick={() => setFilterCategory(filterCategory === 'hidden_charges' ? 'all' : 'hidden_charges')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              filterCategory === 'hidden_charges'
                ? 'bg-primary-fixed/30 border-primary-container shadow-2xs'
                : 'bg-surface-container-lowest border-outline-variant/30 hover:border-outline'
            }`}
          >
            <div className="text-[11px] text-on-surface-variant font-medium">Hidden Charges</div>
            <div className="text-lg font-bold text-on-surface mt-0.5">{summaryByCategory.hidden_charges || 0}</div>
          </button>

          <button
            type="button"
            onClick={() => setFilterCategory(filterCategory === 'cancellation' ? 'all' : 'cancellation')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              filterCategory === 'cancellation'
                ? 'bg-primary-fixed/30 border-primary-container shadow-2xs'
                : 'bg-surface-container-lowest border-outline-variant/30 hover:border-outline'
            }`}
          >
            <div className="text-[11px] text-on-surface-variant font-medium">Cancellation</div>
            <div className="text-lg font-bold text-on-surface mt-0.5">{summaryByCategory.cancellation || 0}</div>
          </button>
        </div>

        {/* AI Status Banner */}
        {aiStatus === 'not_run' && (
          <div className="mt-3 p-2 bg-surface-container-lowest border border-outline-variant/40 rounded-lg flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-outline shrink-0" />
              <span className="font-semibold text-on-surface">AI analysis not run</span>
              <span className="text-on-surface-variant">— {aiStatusMessage || 'Showing deterministic rule findings.'}</span>
            </div>
          </div>
        )}
        {aiStatus === 'failed' && (
          <div className="mt-3 p-2 bg-error-container/40 border border-error/30 rounded-lg flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-error shrink-0" />
              <span className="font-semibold text-on-error-container">AI analysis issue</span>
              <span className="text-on-error-container/80">— {aiStatusMessage || 'Fell back to rule detectors.'}</span>
            </div>
          </div>
        )}
        {aiStatus === 'completed' && (
          <div className="mt-3 p-2 bg-primary-fixed/30 border border-primary/30 rounded-lg flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <span className="font-semibold text-primary">AI analysis verified</span>
              <span className="text-on-surface-variant">— {aiCount} finding{aiCount !== 1 ? 's' : ''} verified against page content</span>
            </div>
          </div>
        )}

        {/* Source Filter Tabs: All / Rule-Only / AI */}
        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-outline-variant/30">
          <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Source:</span>
          <button
            type="button"
            onClick={() => setFilterSource('all')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono transition-all ${
              filterSource === 'all'
                ? 'bg-primary-container text-on-primary-container font-semibold shadow-2xs'
                : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/30'
            }`}
          >
            All ({findings.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSource('rule')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono transition-all ${
              filterSource === 'rule'
                ? 'bg-primary-container text-on-primary-container font-semibold shadow-2xs'
                : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/30'
            }`}
          >
            Rules Only ({ruleCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterSource('ai')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono transition-all ${
              filterSource === 'ai'
                ? 'bg-primary-container text-on-primary-container font-semibold shadow-2xs'
                : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/30'
            }`}
          >
            AI ({aiCount})
          </button>
        </div>

        {/* View Mode Toggle: Plain English vs Detailed Audit */}
        <div className="mt-3 flex items-center justify-between p-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-on-surface">Auditor View:</span>
            <span className="text-[11px] text-on-surface-variant hidden sm:inline">
              {viewMode === 'simple' ? 'Simple explanations for everyday users' : 'Full technical metrics & code proof'}
            </span>
          </div>
          <div className="flex items-center bg-surface-container p-0.5 rounded-lg border border-outline-variant/30">
            <button
              type="button"
              onClick={() => setViewMode('simple')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'simple'
                  ? 'bg-primary-container text-on-primary-container shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              <span>Plain English</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'detailed'
                  ? 'bg-primary-container text-on-primary-container shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Detailed Audit</span>
            </button>
          </div>
        </div>

        {/* Fixed Neutral Disclaimer */}
        <div className="mt-3 p-2 bg-surface-container-lowest border border-outline-variant/30 rounded flex items-start gap-2 text-[11px] text-on-surface-variant">
          <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">info</span>
          <span>{disclaimer}</span>
        </div>
      </div>

      {/* Findings List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-container-lowest">
        {filteredFindings.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] text-primary mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified
            </span>
            <h4 className="text-sm font-semibold text-on-surface">No Deceptive Patterns Detected</h4>
            <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
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
                    ? 'bg-primary-fixed/15 border-primary-container shadow-md ring-1 ring-primary-container'
                    : 'bg-surface-container-lowest border-outline-variant/30 hover:border-outline hover:shadow-2xs'
                }`}
              >
                {viewMode === 'simple' ? (
                  <>
                    {/* Plain English Header */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div>
                        <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
                          <span>{plainInfo.title}</span>
                        </h4>
                        <span className="text-[10px] text-on-surface-variant font-mono capitalize">
                          {finding.category.replace('_', ' ')} Pattern
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getSeverityBadge(finding.severity)}
                      </div>
                    </div>

                    {/* What this website is doing */}
                    <div className="text-xs text-on-surface leading-relaxed mb-3 bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/30">
                      <span className="text-on-surface-variant font-semibold block text-[11px] uppercase tracking-wider mb-1">
                        What this website is doing:
                      </span>
                      <p className="text-on-surface leading-relaxed">{plainInfo.simpleExplanation}</p>
                    </div>

                    {/* Where we found it on screen */}
                    <div className="p-2.5 bg-surface-container-low/70 border border-outline-variant/30 rounded-lg text-xs mb-3">
                      <span className="text-on-surface-variant block text-[10px] uppercase font-semibold tracking-wider mb-1">
                        Where we found it on page:
                      </span>
                      <span className="text-primary font-mono text-[11px] font-medium break-words">{finding.evidence}</span>
                    </div>

                    {/* What you should do */}
                    <div className="p-2.5 bg-primary-fixed/20 border border-primary/30 rounded-lg text-xs">
                      <div className="flex items-center gap-1.5 text-primary font-semibold text-[11px] mb-1">
                        <span className="material-symbols-outlined text-[16px]">tips_and_updates</span>
                        <span>What you should do:</span>
                      </div>
                      <p className="text-on-surface-variant leading-relaxed text-[11px]">
                        {plainInfo.whatToDo}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Detailed Audit View */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-on-surface tracking-wide">
                          {finding.type}
                        </span>
                        {getSourceBadge(finding.source)}
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(finding.severity)}
                        <span className="text-[10px] text-on-surface-variant font-mono font-medium">
                          {Math.round(finding.confidence * 100)}% conf
                        </span>
                      </div>
                    </div>

                    {/* Explanation */}
                    <div className="text-xs text-on-surface leading-relaxed mb-3">
                      <strong className="text-on-surface-variant font-medium">Why it may mislead: </strong>
                      {finding.why}
                    </div>

                    {/* Evidence */}
                    <div className="p-2.5 bg-surface-container-low border border-outline-variant/30 rounded-lg text-xs font-mono text-on-surface mb-3 break-words">
                      <span className="text-on-surface-variant block text-[10px] uppercase font-sans mb-1 font-semibold tracking-wider">
                        Measured Proof / Verbatim Evidence:
                      </span>
                      <span className="text-primary font-medium">{finding.evidence}</span>
                    </div>

                    {/* Safer Alternative */}
                    <div className="p-2.5 bg-primary-fixed/15 border border-primary/20 rounded-lg text-xs">
                      <div className="flex items-center gap-1.5 text-primary font-semibold text-[11px] mb-1">
                        <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                        <span>Safer Design Recommendation</span>
                      </div>
                      <div className="text-on-surface-variant leading-relaxed text-[11px]">
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
