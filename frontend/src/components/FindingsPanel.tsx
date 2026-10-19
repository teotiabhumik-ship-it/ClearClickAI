import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Finding, CategoryType, SignalStrengthType } from '../types';

interface FindingsPanelProps {
  findings: Finding[];
  summaryByCategory: Record<CategoryType, number>;
  selectedFindingIndex: number | null;
  onSelectFinding: (idx: number) => void;
  disclaimer: string;
  aiStatus?: 'ran' | 'skipped_no_key' | 'ai_skipped_budget' | 'unavailable' | 'limit_reached' | 'invalid_response' | 'completed' | 'not_run' | 'failed' | string;
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
    title: 'An optional extra or consent was turned on for you',
    simpleExplanation: 'The page pre-selected a checkbox or option by default. If you proceed without unticking, you accept terms or pay for items you did not actively choose.',
    whatToDo: 'Uncheck the box if you do not want to receive promotional emails, paid extras, or share additional personal data.',
  },
  unequal_button_emphasis: {
    title: 'The Reject option is hard to see',
    simpleExplanation: 'The button to accept tracking or charges uses high-contrast, prominent styling, while the reject or decline option is rendered as faint, small text.',
    whatToDo: 'Look closely for the dimmer secondary button or text link to decline optional cookies and features.',
  },
  missing_reject_button: {
    title: 'Missing direct "Reject All" option',
    simpleExplanation: 'The prompt gives you an immediate single-click "Accept All" button, but forces you through multiple sub-menus or settings tabs to say no.',
    whatToDo: 'Take a moment to open settings and disable non-essential trackers rather than clicking the quick accept button.',
  },
  double_negative_language: {
    title: 'Confusing double-negative language',
    simpleExplanation: 'The prompt uses ambiguous phrasing like "Uncheck to not opt-out," making it counter-intuitive whether checking means yes or no.',
    whatToDo: 'Re-read the label carefully: checking a box with "do not" or "opt-out" often does the opposite of what you expect.',
  },
  microprint_fee: {
    title: 'Hidden fee in tiny or low-contrast print',
    simpleExplanation: 'An extra mandatory fee or surcharge is mentioned only in very small or faint text that is easy to overlook before paying.',
    whatToDo: 'Review the itemized order breakdown before entering payment details to ensure no surprise charges were added.',
  },
  low_contrast_fee: {
    title: 'Faint or hard-to-read fee disclosure',
    simpleExplanation: 'Important pricing terms or recurring renewal fees are displayed in faint text that blends into the background.',
    whatToDo: 'Look out for faint grey text near the total price to find recurring renewal terms or extra fees.',
  },
  drip_pricing: {
    title: 'Mandatory fee withheld until payment step',
    simpleExplanation: 'An unavoidable fee or surcharge was absent from the initial catalog price, appearing only at the final payment screen.',
    whatToDo: 'Compare the final checkout total against the original advertised price to confirm whether the service is genuinely competitive.',
  },
  buried_cancellation: {
    title: 'Hidden cancellation link or account controls',
    simpleExplanation: 'The link to cancel your subscription is concealed in tiny footer print, obscure FAQs, or styled so it does not look clickable.',
    whatToDo: 'Search the page (Ctrl+F or Cmd+F) for keywords like "cancel," "subscription," or "manage account."',
  },
  confirm_shaming: {
    title: 'Guilt-inducing refusal option',
    simpleExplanation: 'The button to decline an offer uses manipulative wording (like "No thanks, I hate saving money") to pressure you into accepting.',
    whatToDo: 'Ignore emotional copy. Decline add-ons and features that you do not need.',
  },
  asymmetric_cancellation_steps: {
    title: 'Difficult multi-step cancellation process',
    simpleExplanation: 'Subscribing was immediate in one click, but cancelling requires navigating through repetitive retention mazes, live calls, or support queues.',
    whatToDo: 'Check your confirmation emails for direct self-service links or review your bank options if a company refuses simple cancellation.',
  },
  countdown_timer: {
    title: 'Artificial urgency countdown timer',
    simpleExplanation: 'A ticking clock pressures you into making a rushed purchasing decision before you can properly inspect the terms.',
    whatToDo: 'Take your time to compare prices. Artificial countdown timers often reset upon reloading.',
  },
  low_stock_scarcity: {
    title: 'Low stock urgency warning',
    simpleExplanation: 'Claims that only a few items remain create immediate pressure to purchase before reviewing alternatives.',
    whatToDo: 'Verify if the item is truly scarce or available from alternative providers at a fairer rate.',
  },
  high_demand_scarcity: {
    title: 'High-demand competition alert',
    simpleExplanation: 'Alerts stating that dozens of people are viewing this offer create competition anxiety to drive impulse purchases.',
    whatToDo: 'Evaluate the purchase calmly based on product specs and price rather than viewing counters.',
  },
  activity_message: {
    title: 'Social proof sales ticker',
    simpleExplanation: 'Notifications boasting recent sales numbers leverage peer pressure to validate the transaction.',
    whatToDo: 'Rely on verified reviews and verified requirements rather than promotional notification toasts.',
  },
  nagging_review: {
    title: 'Interruptive rating or review prompt',
    simpleExplanation: 'Repeated popups demand reviews or feedback without offering a permanent "Don\'t ask again" option.',
    whatToDo: 'Dismiss the prompt or review permissions in browser settings.',
  },
  gamification_referral: {
    title: 'Referral gate or forced social sharing',
    simpleExplanation: 'Promising discounts or unlocking features only if you share contacts or recruit peers turns you into an unpaid promoter.',
    whatToDo: 'Protect your contact list and avoid sharing private information to claim minor discounts.',
  },
  disguised_ads: {
    title: 'Disguised advertisement styled as page content',
    simpleExplanation: 'Sponsored promotional links are styled to look indistinguishable from organic editorial navigation.',
    whatToDo: 'Inspect the destination URL and tiny sponsor disclaimers before clicking.',
  },
  review_needed: {
    title: 'More evidence is needed before drawing a conclusion',
    simpleExplanation: 'The available flow information is incomplete, so ClearClick is not treating this as a confirmed dark pattern.',
    whatToDo: 'Capture both the signup and cancellation journeys, including prompts and required actions, before comparing them.',
  },
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
    simpleExplanation: 'This interface element deviates from balanced, transparent consumer design principles.',
    whatToDo: 'Review the terms and settings carefully before continuing.',
  };
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case 'high':
      return {
        label: 'Serious concern',
        className: 'border border-red-pen text-red-pen bg-red-tint',
      };
    case 'medium':
      return {
        label: 'Caution',
        className: 'border border-border-hairline bg-paper text-ink-muted',
      };
    default:
      return {
        label: 'Notice',
        className: 'border border-border-hairline bg-paper text-ink-muted',
      };
  }
}

function getSourceLabel(source: string, type: string) {
  if (type === 'drip_pricing') return 'Source: Price-flow Tracker';
  if (type.includes('contrast') || type.includes('button')) return 'Source: WCAG APCA Rule Check';
  switch (source) {
    case 'ai':
      return 'Source: Vision LLM';
    case 'hybrid':
      return 'Source: Rule + LLM Verified';
    default:
      return 'Source: Deterministic Rule';
  }
}

function getSignalStrength(confidence: number, signalStrength?: SignalStrengthType): SignalStrengthType {
  if (signalStrength) return signalStrength;
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.75) return 'medium';
  return 'review';
}

function getSignalStrengthBadge(signalStrength: SignalStrengthType) {
  switch (signalStrength) {
    case 'high':
      return { label: 'High signal', className: 'border border-green-700 text-green-800 bg-green-50' };
    case 'medium':
      return { label: 'Medium signal', className: 'border border-border-hairline bg-paper text-ink-muted' };
    default:
      return { label: 'Review signal', className: 'border border-amber-700 text-amber-800 bg-amber-50' };
  }
}

export const FindingsPanel: React.FC<FindingsPanelProps> = ({
  findings,
  selectedFindingIndex,
  onSelectFinding,
}) => {
  const noteRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (selectedFindingIndex !== null && noteRefs.current[selectedFindingIndex]) {
      noteRefs.current[selectedFindingIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedFindingIndex]);

  return (
    <section className="space-y-6 flex flex-col">
      {/* Zero Findings Clean State */}
      {findings.length === 0 ? (
        <article className="border border-border-hairline bg-white rounded-sm p-6 text-center">
          <div className="proof-marker mx-auto mb-3 border-ink-muted text-ink-muted">✓</div>
          <h2 className="font-serif text-lg font-semibold text-ink mb-2">
            No deceptive patterns detected
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed max-w-sm mx-auto">
            ClearClick did not identify hidden fees, cancellation barriers, or one-sided consent choices in the checked regions of this page.
          </p>
        </article>
      ) : (
        /* Margin Notes List */
        findings.map((f, idx) => {
          const markerNum = idx + 1;
          const isSelected = selectedFindingIndex === idx;
          const info = getPlainEnglish(f.type);
          const severityInfo = getSeverityBadge(f.severity);
          const signalStrengthInfo = getSignalStrengthBadge(getSignalStrength(f.confidence, f.signal_strength));
          const sourceLabel = getSourceLabel(f.source, f.type);
          const methodHash =
            f.category === 'hidden_charges'
               ? 'hidden-charges'
              : f.category === 'cancellation'
              ? 'cancellation'
              : 'consent';

          return (
            <article
              key={idx}
              id={`note-${markerNum}`}
              ref={(el) => (noteRefs.current[idx] = el)}
              onClick={() => onSelectFinding(idx)}
              className={`border rounded-sm p-5 relative transition-all cursor-pointer ${
                isSelected
                  ? 'border-red-pen ring-2 ring-red-pen bg-white shadow-none'
                  : 'border-border-hairline bg-white hover:border-ink-muted:border-[#4b4736]'
              }`}
            >
              {/* Note Header: Proof Marker + Serif Title + Severity Badge */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`proof-marker shrink-0 ${isSelected ? 'marker-active' : ''}`}
                  >
                    {markerNum}
                  </span>
                  <h2 className="font-serif text-lg font-semibold text-ink leading-snug">
                    {info.title}
                  </h2>
                </div>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded-sm shrink-0 ${severityInfo.className}`}
                >
                  {severityInfo.label}
                </span>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded-sm shrink-0 ${signalStrengthInfo.className}`}
                  title={`Calibrated confidence: ${Math.round(f.confidence * 100)}%`}
                >
                  {signalStrengthInfo.label}
                </span>
              </div>

              {/* Plain English Summary */}
              <p className="text-ink text-sm mb-3 leading-relaxed">
                {info.simpleExplanation}
              </p>

              {/* Measured Proof Strip */}
              <div className="bg-paper border border-border-hairline rounded-sm p-3 mb-3">
                <div className="font-mono text-xs text-ink-muted mb-1.5 uppercase font-medium tracking-wide">
                  Measured Proof
                </div>
                <div className="text-xs font-mono space-y-1.5 break-words">
                  {f.evidence && (
                    <p>
                      <span className="text-ink font-medium">Observed element:</span>{' '}
                      <span className="text-ink-muted">{f.evidence}</span>
                    </p>
                  )}
                  {f.why && (
                    <p>
                      <span className="text-ink font-medium">Observation:</span>{' '}
                      <span className="text-ink-muted">{f.why}</span>
                    </p>
                  )}
                  {f.safer_alternative && (
                    <p className="pt-1 border-t border-border-hairline">
                      <span className="text-ink font-medium">Fair design alternative:</span>{' '}
                      <span className="text-ink-muted">{f.safer_alternative}</span>
                    </p>
                  )}
                  {(f.rule_evidence || f.ai_evidence) && (
                    <div className="pt-1 border-t border-border-hairline">
                      <span className="text-ink font-medium">Evidence provenance:</span>
                      {f.rule_evidence && <p className="text-ink-muted">Rule measurement: {f.rule_evidence}</p>}
                      {f.ai_evidence && <p className="text-ink-muted">AI interpretation: {f.ai_evidence}</p>}
                    </div>
                  )}
                </div>
              </div>

              {f.related_signals && f.related_signals.length > 0 && (
                <div className="border border-dashed border-border-hairline rounded-sm p-3 mb-3 bg-white">
                  <p className="font-mono text-xs uppercase font-medium tracking-wide text-ink mb-1.5">
                    Related measured signals
                  </p>
                  <p className="text-xs text-ink-muted leading-relaxed mb-2">
                    These signals point to the same element and may describe one underlying issue, rather than separate problems.
                  </p>
                  <div className="font-mono text-xs space-y-1.5 break-words">
                    {f.related_signals.map((signal, signalIndex) => (
                      <p key={`${signal.type}-${signalIndex}`}>
                        <span className="text-ink font-medium">{signal.type.replace(/_/g, ' ')}:</span>{' '}
                        <span className="text-ink-muted">{signal.evidence}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Note Footer: Source Attribution & Link to Fairer Version */}
              <div className="flex items-center justify-between pt-2 border-t border-border-hairline text-xs">
                <span className="font-mono text-ink-muted">{sourceLabel}</span>
                <Link
                  to={`/methodology#${methodHash}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-ink underline decoration-1 hover:text-red-pen transition-colors font-medium"
                >
                  Fairer version →
                </Link>
              </div>
            </article>
          );
        })
      )}

      {/* Footer Informational Note Explaining Proofreader Approach */}
      <div className="border border-dashed border-border-hairline p-4 rounded-sm text-xs text-ink-muted">
        <p className="font-medium text-ink mb-1">How ClearClick marks up pages</p>
        <p className="leading-relaxed">
          Unlike automated rating engines, we do not assign an overall percentage score. We mark verifiable deviations against consumer transparency rules so you can form your own judgment.
        </p>
      </div>
    </section>
  );
};
