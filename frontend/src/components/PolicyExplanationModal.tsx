import React, { useEffect } from 'react';
import {
  X,
  HelpCircle,
  ExternalLink,
  Shield,
  Layers,
  Filter,
  Copy,
  Bot,
  ShieldAlert,
  Lock,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export interface PolicyModalData {
  url?: string;
  pageType?: string;
  reason: string;
  statusReason?: string;
  score?: number;
}

interface PolicyExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PolicyModalData | null;
  onAnalyzePage?: (url: string) => void;
}

interface PolicyRuleInfo {
  title: string;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
  summary: string;
  why: string;
  whatYouCanDo: string;
  canAuditIndividually: boolean;
}

const POLICY_RULES: Record<string, PolicyRuleInfo> = {
  skipped_cap: {
    title: 'Maximum Page Budget Cap Reached',
    badge: '8 Pages Limit',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    icon: <Layers className="w-5 h-5 text-slate-700" />,
    summary: 'ClearClick enforces a maximum cap of 8 pages per site audit to ensure polite, fast, and server-safe scans.',
    why: 'During discovery, ClearClick extracts all same-domain links and scores them based on commercial relevance (pricing, cart, checkout, cancellation, consent). The top 8 highest-priority transactional pages were selected and analysed. This page was discovered, but ranked beyond the 8-page budget ceiling.',
    whatYouCanDo: 'If this specific page is critical to your audit, you can analyze it directly using single-page inspection.',
    canAuditIndividually: true,
  },
  skipped_low_priority: {
    title: 'Content Relevance Filter (Low Commercial Priority)',
    badge: 'Relevance Filter',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: <Filter className="w-5 h-5 text-amber-700" />,
    summary: 'This page scored below the priority threshold for deceptive interface design inspection.',
    why: 'Dark patterns concentrate where user choices involve financial commitments, recurring billing, or consent—specifically checkout funnels, subscription tiers, cancellation portals, and cookie banners. Non-commercial pages like blog posts, news articles, careers, and documentation are intentionally skipped to preserve inspection bandwidth.',
    whatYouCanDo: 'If you suspect deceptive design or hidden terms on this page, you can audit it individually on demand.',
    canAuditIndividually: true,
  },
  skipped_robots: {
    title: 'Robots.txt Crawling Exclusion Directive',
    badge: 'Robots Disallowed',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    icon: <Bot className="w-5 h-5 text-purple-700" />,
    summary: 'The site owner has explicitly prohibited automated crawlers from accessing this path in robots.txt.',
    why: 'ClearClick is engineered with strict crawler ethics. We always fetch and parse the site’s robots.txt before making requests. When a webmaster specifies a "Disallow" rule matching this path, ClearClick strictly honors their boundary and will never bypass, spoof, or ignore their directive.',
    whatYouCanDo: 'To inspect this page without automated crawling, you can save the rendered HTML in your browser or capture a screenshot and upload it for manual inspection.',
    canAuditIndividually: false,
  },
  robots_disallowed: {
    title: 'Robots.txt Crawling Exclusion Directive',
    badge: 'Robots Disallowed',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    icon: <Bot className="w-5 h-5 text-purple-700" />,
    summary: 'The site owner has explicitly prohibited automated crawlers from accessing this path in robots.txt.',
    why: 'ClearClick is engineered with strict crawler ethics. We always fetch and parse the site’s robots.txt before making requests. When a webmaster specifies a "Disallow" rule matching this path, ClearClick strictly honors their boundary and will never bypass, spoof, or ignore their directive.',
    whatYouCanDo: 'To inspect this page without automated crawling, you can save the rendered HTML in your browser or capture a screenshot and upload it for manual inspection.',
    canAuditIndividually: false,
  },
  skipped_duplicate: {
    title: 'Template Deduplication Policy',
    badge: 'Duplicate Template',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
    icon: <Copy className="w-5 h-5 text-sky-700" />,
    summary: 'This URL shares an identical structural template with another page already being analysed.',
    why: 'E-commerce sites often contain hundreds or thousands of product URLs that use the exact same template and only differ by product ID or slug. Auditing multiple identical templates yields redundant findings and wastes target server bandwidth. ClearClick collapses near-duplicate templates to audit one representative page.',
    whatYouCanDo: 'Review the findings on the representative product page already included in this report.',
    canAuditIndividually: true,
  },
  skipped_blocked_domain: {
    title: 'Polite Domain Cooldown Policy',
    badge: 'Domain Cooldown',
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
    icon: <ShieldAlert className="w-5 h-5 text-rose-700" />,
    summary: 'The target host returned anti-bot challenges or HTTP 403/429 rate limit errors.',
    why: 'ClearClick adheres to strict non-circumvention rules. We do not use proxy rotators, stealth fingerprint spoofing, or CAPTCHA solving farms. When a server signals that automated tools are blocked, ClearClick halts further scans on that domain to respect server boundaries.',
    whatYouCanDo: 'You can audit the page offline by saving the rendered HTML in your browser or uploading a screenshot.',
    canAuditIndividually: false,
  },
  needs_login: {
    title: 'Authentication Boundary',
    badge: 'Login Required',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    icon: <Lock className="w-5 h-5 text-blue-700" />,
    summary: 'This page is gated behind user login credentials or an account subscription.',
    why: 'ClearClick never stores, creates, or submits user passwords or personal credentials on external websites. Any page requiring authentication cannot be navigated automatically.',
    whatYouCanDo: 'Log in using your personal browser, take a screenshot of the account or cancellation flow, and upload it for pattern inspection.',
    canAuditIndividually: false,
  },
  empty: {
    title: 'Sparse or Empty Content',
    badge: 'Empty DOM',
    badgeColor: 'bg-stone-100 text-stone-800 border-stone-300',
    icon: <AlertTriangle className="w-5 h-5 text-stone-600" />,
    summary: 'The page returned with insufficient text or interactive DOM elements to analyze.',
    why: 'Pattern auditing requires extractable prices, labels, buttons, and disclosure text. Pages that fail client-side hydration or return blank containers cannot be reliably evaluated.',
    whatYouCanDo: 'Verify the URL opens in your browser and check if the content relies on heavy client-side scripts.',
    canAuditIndividually: true,
  },
  timeout: {
    title: 'Page Response Timeout',
    badge: 'Server Timeout',
    badgeColor: 'bg-orange-100 text-orange-900 border-orange-300',
    icon: <Clock className="w-5 h-5 text-orange-700" />,
    summary: 'The target server took too long to respond within the allocated timeout window.',
    why: 'To prevent hangs and maintain predictable scan duration, each page fetch is bounded by a 15-second timeout.',
    whatYouCanDo: 'Check if the site is experiencing downtime or slow response times and try again.',
    canAuditIndividually: true,
  },
};

export const PolicyExplanationModal: React.FC<PolicyExplanationModalProps> = ({
  isOpen,
  onClose,
  data,
  onAnalyzePage,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const key = data?.reason?.toLowerCase().trim() || 'skipped_cap';
  const matchedRule = POLICY_RULES[key] || {
    title: 'Polite Crawling Policy',
    badge: 'Audit Policy',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    icon: <Shield className="w-5 h-5 text-slate-700" />,
    summary: 'This page was discovered but skipped in accordance with ClearClick’s automated crawling policies.',
    why: 'ClearClick prioritizes transactional pages (pricing, cart, checkout, cancellation, consent) and enforces limits to respect target servers.',
    whatYouCanDo: 'You can review the methodology or audit this page individually if needed.',
    canAuditIndividually: !!data?.url,
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-outline-variant/60 relative animate-in fade-in zoom-in-95 duration-200 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Strip */}
        <div className="flex items-start justify-between gap-4 border-b border-border-hairline pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              {matchedRule.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${matchedRule.badgeColor}`}>
                  {matchedRule.badge}
                </span>
                <span className="text-xs font-mono text-ink-muted">ClearClick Audit Policy</span>
              </div>
              <h2 id="policy-modal-title" className="text-lg sm:text-xl font-serif font-bold text-ink mt-0.5">
                {matchedRule.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Close policy explanation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Specific Page Telemetry (if opened for a specific page) */}
        {data?.url && (
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Target Page</span>
              {data.pageType && (
                <span className="capitalize px-1.5 py-0.5 rounded bg-white text-ink border border-border-hairline font-mono text-[11px]">
                  Detected: {data.pageType}
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-ink break-all select-all font-medium">
              {data.url}
            </p>
            {data.statusReason && (
              <div className="pt-1.5 mt-1 border-t border-outline-variant/30 text-[11px] text-ink-muted flex items-start gap-1.5">
                <span className="font-semibold text-ink shrink-0">Crawler telemetry:</span>
                <span>{data.statusReason}</span>
              </div>
            )}
          </div>
        )}

        {/* Policy Summary */}
        <div className="space-y-3 text-sm text-ink-muted">
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-wider text-ink mb-1">
              Summary
            </h4>
            <p className="leading-relaxed text-ink">
              {matchedRule.summary}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-xs uppercase tracking-wider text-ink mb-1">
              Why ClearClick follows this rule
            </h4>
            <p className="leading-relaxed text-xs">
              {matchedRule.why}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-xs uppercase tracking-wider text-ink mb-1">
              What you can do
            </h4>
            <p className="leading-relaxed text-xs">
              {matchedRule.whatYouCanDo}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-border-hairline flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <Link
            to="/methodology#limits"
            onClick={onClose}
            className="text-xs text-amber-800 hover:text-amber-950 hover:underline inline-flex items-center gap-1 font-medium"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Read full methodology & limits</span>
            <ExternalLink className="w-3 h-3" />
          </Link>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {data?.url && matchedRule.canAuditIndividually && onAnalyzePage && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAnalyzePage(data.url!);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Audit this page individually</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-border-hairline text-xs font-semibold text-ink hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
