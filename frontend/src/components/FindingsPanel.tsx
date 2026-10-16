import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal, Eye, Info, CheckCircle, Lightbulb } from 'lucide-react';
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
  preticked_consent: {
    title: 'Pre-Checked Agreement Box',
    simpleExplanation: 'The website automatically checked a box to sign you up for emails, marketing, or data sharing instead of letting you choose yourself.',
    whatToDo: 'Uncheck the box if you do not want to receive promotional emails or share extra personal data.'
  },
  unequal_button_emphasis: {
    title: 'Unequal Button Choices',
    simpleExplanation: 'The button to accept tracking or payments is bright, large, and obvious, while the reject or skip option is faint, tiny, or styled like plain text.',
    whatToDo: 'Look closely for the dimmer secondary button or text link to decline optional cookies and features.'
  },
  missing_reject_button: {
    title: 'Missing "Reject All" Option',
    simpleExplanation: 'The banner gives you an immediate "Accept All" button, but forces you to click into complex settings or toggle individual switches to say no.',
    whatToDo: 'Take a moment to open settings and disable non-essential cookies rather than clicking the quick accept button.'
  },
  double_negative_language: {
    title: 'Confusing Double-Negative Language',
    simpleExplanation: 'The setting uses confusing phrasing like "Uncheck to not opt-out," making it hard to tell whether checking the box means yes or no.',
    whatToDo: 'Re-read the label carefully: checking a box with "do not" or "opt-out" often does the opposite of what you expect.'
  },
  microprint_fee: {
    title: 'Hidden Fee in Tiny Print',
    simpleExplanation: 'An extra mandatory fee or surcharge is mentioned only in very small text that is easy to overlook while reviewing the price.',
    whatToDo: 'Check the final order breakdown before entering payment details to ensure no surprise charges were added.'
  },
  low_contrast_fee: {
    title: 'Faint or Hard-to-Read Fee Disclosure',
    simpleExplanation: 'Important pricing terms or fee notices are displayed in faint, low-contrast text that blends into the background.',
    whatToDo: 'Look out for faint grey text near the total price to find recurring renewal terms or extra fees.'
  },
  drip_pricing: {
    title: 'Unexpected Fee Added at Checkout',
    simpleExplanation: 'The total price increased at the final payment screen with unavoidable fees that were never mentioned when you selected the item.',
    whatToDo: 'Compare the final checkout total against the original advertised price to see if the deal is still worthwhile.'
  },
  buried_cancellation: {
    title: 'Hidden Cancellation Link',
    simpleExplanation: 'The link to cancel your subscription is hidden at the very bottom of the page or styled so it does not look clickable.',
    whatToDo: 'Search the page (Ctrl+F or Cmd+F) for words like "cancel," "subscription," or "manage account."'
  },
  confirm_shaming: {
    title: 'Guilt-Inducing Refusal Option',
    simpleExplanation: 'The button to decline an offer uses manipulative wording (like "No thanks, I hate saving money") to make you feel bad about refusing.',
    whatToDo: 'Ignore the emotional language. Decline offers that you do not need.'
  },
  asymmetric_cancellation_steps: {
    title: 'Difficult Cancellation Process',
    simpleExplanation: 'Signing up took one click, but cancelling requires a live phone call during limited hours, chat support queues, or unnecessary survey hoops.',
    whatToDo: 'Check your subscription terms or email receipts for online self-service cancellation links before calling.'
  },
  countdown_timer: {
    title: 'Artificial Time Limit',
    simpleExplanation: 'A ticking clock or "offer ends in 10 minutes" ticker pressures you into making a hasty financial choice before you can properly think.',
    whatToDo: 'Take your time to compare prices. Many countdown timers automatically reset when the page reloads.'
  },
  low_stock_scarcity: {
    title: 'Low Stock Warning',
    simpleExplanation: 'Claims that "Only 2 items left in stock" create urgent fear of missing out so you purchase before checking alternatives.',
    whatToDo: 'Verify if the item is truly scarce or available from other sellers at a better price.'
  },
  high_demand_scarcity: {
    title: 'High Demand Competition Alert',
    simpleExplanation: 'Alerts saying "18 people are looking at this right now" use competition anxiety to make you feel you might lose out if you do not buy immediately.',
    whatToDo: 'Recognize this as a sales tactic. Check the actual item details and final checkout terms calmly.'
  },
  activity_message: {
    title: 'Social Proof Sales Tally',
    simpleExplanation: 'Messages boasting "50 items sold in the last 24 hours" use peer pressure and bandwagon effects to validate the purchase.',
    whatToDo: 'Judge the product on its actual specifications, price, and real reviews rather than recent sales counters.'
  },
  nagging_review: {
    title: 'Interruptive Rating Prompt',
    simpleExplanation: 'Popups asking you to rate the app or service interrupt what you are doing, often without a permanent "Never ask again" option.',
    whatToDo: 'Dismiss the prompt or look for "No thanks" / "Don\'t ask again". Rate apps only when and if you choose to do so in the settings.'
  },
  gamification_referral: {
    title: 'Viral Referral / Ad Gate',
    simpleExplanation: 'Promising bonus tokens, discounts, or unlocked features only if you recruit your friends or watch advertisements turns you into an unpaid promoter.',
    whatToDo: 'Carefully consider if you want to share your contacts or personal information just to unlock a feature.'
  },
  disguised_ads: {
    title: 'Disguised Advertisement',
    simpleExplanation: 'Sponsored promotional links are styled to look identical to real editorial articles or navigation links, with the "Ad" label hidden in tiny, faint text.',
    whatToDo: 'Check the destination URL before clicking to verify whether it leads to the actual site content or a third-party paid sponsor.'
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
          <span className="bg-[#B91C1C]/15 dark:bg-[#B91C1C]/25 text-[#B91C1C] border border-[#B91C1C]/30 px-2 py-0.5 rounded text-xs font-semibold uppercase">
            {viewMode === 'simple' ? 'Serious' : 'High Severity'}
          </span>
        );
      case 'medium':
        return (
          <span className="bg-[#B45309]/15 dark:bg-[#B45309]/25 text-[#B45309] border border-[#B45309]/30 px-2 py-0.5 rounded text-xs font-semibold uppercase">
            {viewMode === 'simple' ? 'Caution' : 'Medium'}
          </span>
        );
      case 'low':
        return (
          <span className="bg-[#1D4ED8]/15 dark:bg-[#1D4ED8]/25 text-[#1D4ED8] border border-[#1D4ED8]/30 px-2 py-0.5 rounded text-xs font-semibold uppercase">
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
        return (
          <Link
            to="/methodology#how-it-checks"
            title="Read how rule checks operate"
            className="bg-surface-container dark:bg-[#111A2E] text-on-surface-variant dark:text-[#94A3B8] border border-outline-variant/40 dark:border-[#26324A] px-2 py-0.5 rounded text-xs font-mono font-medium hover:border-outline hover:text-on-surface transition-colors"
          >
            RULE ENGINE
          </Link>
        );
      case 'ai':
        return (
          <Link
            to="/methodology#how-it-checks"
            title="Read how AI verification operates"
            className="bg-primary-fixed/40 dark:bg-[#2DD4BF]/20 text-primary dark:text-[#2DD4BF] border border-primary/40 dark:border-[#2DD4BF]/30 px-2 py-0.5 rounded text-xs font-mono font-semibold hover:border-primary transition-colors"
          >
            AI INSPECTION
          </Link>
        );
      default:
        return (
          <Link
            to="/methodology#how-it-checks"
            className="bg-surface-container-high dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] px-2 py-0.5 rounded text-xs font-mono font-medium hover:underline"
          >
            HYBRID
          </Link>
        );
    }
  };

  return (
    <div className="bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] rounded-xl flex flex-col h-full shadow-[0px_1px_3px_rgba(15,23,42,0.04)] overflow-hidden min-h-[540px]">
      {/* Category Breakdown Header */}
      <div className="p-4 bg-surface-container-low dark:bg-[#0B1220] border-b border-outline-variant/30 dark:border-[#26324A]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-on-surface dark:text-[#E2E8F0] uppercase tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-primary dark:text-[#2DD4BF]" aria-hidden="true" />
            <span>Category Breakdown</span>
          </h3>
          <span className="text-xs font-mono text-on-surface-variant dark:text-[#94A3B8] font-medium">
            {findings.length} Finding{findings.length !== 1 ? 's' : ''} Emitted
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setFilterCategory(filterCategory === 'consent' ? 'all' : 'consent')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              filterCategory === 'consent'
                ? 'bg-primary-fixed/30 dark:bg-[#2DD4BF]/20 border-primary-container dark:border-[#2DD4BF] shadow-2xs'
                : 'bg-surface-container-lowest dark:bg-[#111A2E] border-outline-variant/30 dark:border-[#26324A] hover:border-outline'
            }`}
          >
            <div className="text-xs text-on-surface-variant dark:text-[#94A3B8] font-medium">Consent</div>
            <div className="text-lg font-bold text-on-surface dark:text-[#E2E8F0] mt-0.5">{summaryByCategory.consent || 0}</div>
          </button>

          <button
            type="button"
            onClick={() => setFilterCategory(filterCategory === 'hidden_charges' ? 'all' : 'hidden_charges')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              filterCategory === 'hidden_charges'
                ? 'bg-primary-fixed/30 dark:bg-[#2DD4BF]/20 border-primary-container dark:border-[#2DD4BF] shadow-2xs'
                : 'bg-surface-container-lowest dark:bg-[#111A2E] border-outline-variant/30 dark:border-[#26324A] hover:border-outline'
            }`}
          >
            <div className="text-xs text-on-surface-variant dark:text-[#94A3B8] font-medium">Hidden Charges</div>
            <div className="text-lg font-bold text-on-surface dark:text-[#E2E8F0] mt-0.5">{summaryByCategory.hidden_charges || 0}</div>
          </button>

          <button
            type="button"
            onClick={() => setFilterCategory(filterCategory === 'cancellation' ? 'all' : 'cancellation')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              filterCategory === 'cancellation'
                ? 'bg-primary-fixed/30 dark:bg-[#2DD4BF]/20 border-primary-container dark:border-[#2DD4BF] shadow-2xs'
                : 'bg-surface-container-lowest dark:bg-[#111A2E] border-outline-variant/30 dark:border-[#26324A] hover:border-outline'
            }`}
          >
            <div className="text-xs text-on-surface-variant dark:text-[#94A3B8] font-medium">Cancellation</div>
            <div className="text-lg font-bold text-on-surface dark:text-[#E2E8F0] mt-0.5">{summaryByCategory.cancellation || 0}</div>
          </button>
        </div>

        {/* AI Status Banner */}
        {aiStatus === 'not_run' && (
          <div className="mt-3 p-2 bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/40 dark:border-[#26324A] rounded-lg flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-outline dark:bg-[#94A3B8] shrink-0" />
              <span className="font-semibold text-on-surface dark:text-[#E2E8F0]">AI analysis not run</span>
              <span className="text-on-surface-variant dark:text-[#94A3B8] truncate">— {aiStatusMessage || 'Showing deterministic rule findings.'}</span>
            </div>
            <Link to="/methodology#limits" className="text-primary dark:text-[#2DD4BF] hover:underline font-semibold ml-2 shrink-0">
              Limits
            </Link>
          </div>
        )}
        {aiStatus === 'failed' && (
          <div className="mt-3 p-2 bg-error-container/40 dark:bg-[#B91C1C]/20 border border-error/30 dark:border-[#B91C1C]/40 rounded-lg flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-error shrink-0" />
              <span className="font-semibold text-on-error-container dark:text-red-200">AI analysis issue</span>
              <span className="text-on-error-container/80 dark:text-red-300 truncate">— {aiStatusMessage || 'Fell back to rule detectors.'}</span>
            </div>
            <Link to="/methodology#limits" className="text-error dark:text-red-300 hover:underline font-semibold ml-2 shrink-0">
              Limits
            </Link>
          </div>
        )}
        {aiStatus === 'completed' && (
          <div className="mt-3 p-2 bg-primary-fixed/30 dark:bg-[#2DD4BF]/20 border border-primary/30 dark:border-[#2DD4BF]/30 rounded-lg flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary dark:bg-[#2DD4BF] shrink-0" />
              <span className="font-semibold text-primary dark:text-[#2DD4BF]">AI analysis verified</span>
              <span className="text-on-surface-variant dark:text-[#94A3B8]">— {aiCount} finding{aiCount !== 1 ? 's' : ''} verified against page content</span>
            </div>
          </div>
        )}

        {/* Source Filter Tabs: All / Rule-Only / AI */}
        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-outline-variant/30 dark:border-[#26324A]">
          <span className="text-xs uppercase font-bold text-on-surface-variant dark:text-[#94A3B8] tracking-wider">Source:</span>
          <button
            type="button"
            onClick={() => setFilterSource('all')}
            className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
              filterSource === 'all'
                ? 'bg-surface-container-highest dark:bg-[#26324A] text-on-surface dark:text-[#E2E8F0]'
                : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface'
            }`}
          >
            All ({findings.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSource('rule')}
            className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
              filterSource === 'rule'
                ? 'bg-surface-container-highest dark:bg-[#26324A] text-on-surface dark:text-[#E2E8F0]'
                : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface'
            }`}
          >
            Rules Only ({ruleCount})
          </button>
          {aiCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterSource('ai')}
              className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                filterSource === 'ai'
                  ? 'bg-surface-container-highest dark:bg-[#26324A] text-on-surface dark:text-[#E2E8F0]'
                  : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface'
              }`}
            >
              AI Verified ({aiCount})
            </button>
          )}

          {/* Mode Switcher: Plain English vs Detailed Audit */}
          <div className="ml-auto flex items-center bg-surface-container dark:bg-[#0B1220] p-0.5 rounded-lg border border-outline-variant/40 dark:border-[#26324A]">
            <button
              type="button"
              onClick={() => setViewMode('simple')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'simple'
                  ? 'bg-primary-container text-on-primary-container dark:bg-[#005c55] dark:text-white shadow-2xs'
                  : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface'
              }`}
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Plain English</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'detailed'
                  ? 'bg-primary-container text-on-primary-container dark:bg-[#005c55] dark:text-white shadow-2xs'
                  : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Detailed Audit</span>
            </button>
          </div>
        </div>

        {/* Fixed Neutral Disclaimer */}
        <div className="mt-3 p-2 bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] rounded flex items-start gap-2 text-xs text-on-surface-variant dark:text-[#94A3B8]">
          <Info className="w-4 h-4 text-primary dark:text-[#2DD4BF] shrink-0 mt-0.5" aria-hidden="true" />
          <span>{disclaimer}</span>
        </div>
      </div>

      {/* Findings List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-container-lowest dark:bg-[#111A2E]">
        {filteredFindings.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-on-surface-variant dark:text-[#94A3B8]">
            <CheckCircle className="w-12 h-12 text-primary dark:text-[#2DD4BF] mb-2" aria-hidden="true" />
            <h4 className="text-base font-semibold text-on-surface dark:text-[#E2E8F0]">No Deceptive Patterns Detected</h4>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] mt-1 max-w-sm">
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
                    ? 'bg-primary-fixed/15 dark:bg-[#2DD4BF]/10 border-primary-container dark:border-[#2DD4BF] shadow-md ring-1 ring-primary-container'
                    : 'bg-surface-container-lowest dark:bg-[#111A2E] border-outline-variant/30 dark:border-[#26324A] hover:border-outline hover:shadow-2xs'
                }`}
              >
                {viewMode === 'simple' ? (
                  <>
                    {/* Plain English Header */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div>
                        <h4 className="text-base font-bold text-on-surface dark:text-[#E2E8F0] flex items-center gap-2">
                          <span>{plainInfo.title}</span>
                        </h4>
                        <span className="text-xs text-on-surface-variant dark:text-[#94A3B8] font-mono capitalize">
                          {finding.category.replace('_', ' ')} Pattern
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(finding.severity)}
                      </div>
                    </div>

                    {/* What this website is doing */}
                    <div className="p-3 bg-surface-container-low dark:bg-[#0B1220] rounded-lg text-sm mb-3">
                      <span className="text-on-surface-variant dark:text-[#94A3B8] block text-xs font-semibold tracking-wider mb-1">
                        What this website is doing:
                      </span>
                      <p className="text-on-surface dark:text-[#E2E8F0] leading-relaxed">{plainInfo.simpleExplanation}</p>
                    </div>

                    {/* Where we found it on screen */}
                    <div className="p-2.5 bg-surface-container-low/70 dark:bg-[#0B1220]/70 border border-outline-variant/30 dark:border-[#26324A] rounded-lg text-sm mb-3">
                      <span className="text-on-surface-variant dark:text-[#94A3B8] block text-xs uppercase font-semibold tracking-wider mb-1">
                        Where we found it on page:
                      </span>
                      <span className="text-primary dark:text-[#2DD4BF] font-mono text-xs font-medium break-words">{finding.evidence}</span>
                    </div>

                    {/* What you should do */}
                    <div className="p-3 bg-primary-fixed/20 dark:bg-[#2DD4BF]/15 border border-primary/30 dark:border-[#2DD4BF]/30 rounded-lg text-sm">
                      <div className="flex items-center gap-1.5 text-primary dark:text-[#2DD4BF] font-semibold text-xs mb-1">
                        <Lightbulb className="w-4 h-4" aria-hidden="true" />
                        <span>What you should do:</span>
                      </div>
                      <p className="text-on-surface-variant dark:text-[#94A3B8] leading-relaxed text-sm">
                        {plainInfo.whatToDo}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Detailed Audit View */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-on-surface dark:text-[#E2E8F0] tracking-wide">
                          {finding.type}
                        </span>
                        {getSourceBadge(finding.source)}
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(finding.severity)}
                        <span className="text-xs text-on-surface-variant dark:text-[#94A3B8] font-mono font-medium">
                          {Math.round(finding.confidence * 100)}% conf
                        </span>
                      </div>
                    </div>

                    {/* Explanation */}
                    <div className="text-sm text-on-surface dark:text-[#E2E8F0] leading-relaxed mb-3">
                      <strong className="text-on-surface-variant dark:text-[#94A3B8] font-medium">Why it may mislead: </strong>
                      {finding.why}
                    </div>

                    {/* Evidence */}
                    <div className="p-2.5 bg-surface-container-low dark:bg-[#0B1220] border border-outline-variant/30 dark:border-[#26324A] rounded-lg text-sm font-mono text-on-surface dark:text-[#E2E8F0] mb-3 break-words">
                      <span className="text-on-surface-variant dark:text-[#94A3B8] block text-xs uppercase font-sans mb-1 font-semibold tracking-wider">
                        Measured Proof / Verbatim Evidence:
                      </span>
                      <span className="text-primary dark:text-[#2DD4BF] font-medium">{finding.evidence}</span>
                    </div>

                    {/* Safer Alternative */}
                    <div className="p-3 bg-primary-fixed/15 dark:bg-[#2DD4BF]/15 border border-primary/20 dark:border-[#2DD4BF]/20 rounded-lg text-sm">
                      <div className="flex items-center gap-1.5 text-primary dark:text-[#2DD4BF] font-semibold text-xs mb-1">
                        <Lightbulb className="w-4 h-4" aria-hidden="true" />
                        <span>Safer Design Recommendation</span>
                      </div>
                      <div className="text-on-surface-variant dark:text-[#94A3B8] leading-relaxed text-sm">
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
