import React, { useState } from 'react';
import {
  ShieldAlert,
  CreditCard,
  Ban,
  CheckSquare,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Lock,
  Layers,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
  UploadCloud,
  PlayCircle,
  Camera,
  HelpCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Scan, ScanPage, GroupedFinding } from '../types';
import { ScreenshotViewer } from './ScreenshotViewer';
import { PolicyExplanationModal, PolicyModalData } from './PolicyExplanationModal';

interface ScanReportViewProps {
  scan: Scan;
  onOpenUpload?: () => void;
  onStartFlow?: (url: string) => void;
  onAnalyzeSinglePage?: (url: string) => void;
}

export const ScanReportView: React.FC<ScanReportViewProps> = ({
  scan,
  onOpenUpload,
  onStartFlow,
  onAnalyzeSinglePage,
}) => {
  const [expandedFindings, setExpandedFindings] = useState<Record<number, boolean>>({});
  const [expandedPages, setExpandedPages] = useState<boolean>(true);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [selectedPageUrl, setSelectedPageUrl] = useState<string>(() => {
    const firstWithScreenshot = scan.pages.find((p) => p.screenshot_base64 && p.screenshot_base64.trim().length > 0);
    const firstAnalysed = firstWithScreenshot || scan.pages.find((p) => p.decision === 'will_analyse' && p.page_status === 'ok') || scan.pages[0];
    return firstAnalysed ? firstAnalysed.url : scan.root_url;
  });
  const [selectedFindingIndex, setSelectedFindingIndex] = useState<number | null>(null);
  const [policyModalData, setPolicyModalData] = useState<PolicyModalData | null>(null);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);

  const handleOpenPolicyModal = (page: ScanPage) => {
    setPolicyModalData({
      url: page.url,
      pageType: page.page_type,
      reason: page.skipped_reason || page.page_status || page.decision || 'skipped_cap',
      statusReason: page.status_reason,
      score: page.score,
    });
    setIsPolicyModalOpen(true);
  };

  const handleOpenPolicyCategory = (reason: string) => {
    setPolicyModalData({
      reason,
      statusReason: `Discovered pages skipped under the ${reason.replace('skipped_', '').replace('_', ' ')} policy.`,
    });
    setIsPolicyModalOpen(true);
  };

  const toggleFinding = (idx: number) => {
    setExpandedFindings((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getPageStatusBadge = (page: ScanPage) => {
    // 1. If page was skipped before analysis, show explicit interactive skipped badge
    if (page.decision !== 'will_analyse') {
      const reason = page.skipped_reason || page.decision;
      let label = 'Skipped';
      let icon = '⏸';
      let colorClass = 'bg-slate-100 text-slate-700 border-slate-300';

      switch (reason) {
        case 'skipped_cap':
          label = 'Skipped (quota cap)';
          icon = '⏸';
          colorClass = 'bg-slate-100 text-slate-700 border-slate-300';
          break;
        case 'skipped_low_priority':
          label = 'Skipped (low priority)';
          icon = '⏭';
          colorClass = 'bg-slate-100 text-slate-700 border-slate-300';
          break;
        case 'skipped_duplicate':
          label = 'Skipped (duplicate template)';
          icon = '⎘';
          colorClass = 'bg-slate-100 text-slate-700 border-slate-300';
          break;
        case 'skipped_robots':
          label = 'Robots disallowed';
          icon = '🤖';
          colorClass = 'bg-purple-100 text-purple-900 border-purple-300';
          break;
        case 'skipped_blocked_domain':
          label = 'Domain cooldown';
          icon = '⛔';
          colorClass = 'bg-amber-100 text-amber-900 border-amber-300';
          break;
        default:
          label = 'Skipped';
          icon = '⏸';
          colorClass = 'bg-slate-100 text-slate-700 border-slate-300';
          break;
      }

      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenPolicyModal(page);
          }}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${colorClass} border hover:opacity-85 transition-opacity cursor-pointer text-left group`}
          title="Click to see why this page was skipped by policy"
        >
          <span aria-hidden="true">{icon}</span>
          <span>{label}</span>
          <HelpCircle className="w-3 h-3 text-ink-muted group-hover:text-ink opacity-70 ml-0.5" />
        </button>
      );
    }

    // 2. For pages that were queued and attempted:
    switch (page.page_status) {
      case 'ok':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span aria-hidden="true">✓</span>
            <span>Analysed</span>
          </span>
        );
      case 'blocked':
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPolicyModal(page);
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-900 border border-amber-300 hover:opacity-85 transition-opacity cursor-pointer group"
            title="Click to see why this page was blocked"
          >
            <span aria-hidden="true">⛔</span>
            <span>Blocked by site</span>
            <HelpCircle className="w-3 h-3 text-amber-800 opacity-70 ml-0.5" />
          </button>
        );
      case 'needs_login':
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPolicyModal(page);
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-900 border border-blue-300 hover:opacity-85 transition-opacity cursor-pointer group"
            title="Click to see why login pages are not automated"
          >
            <span aria-hidden="true">🔒</span>
            <span>Requires login</span>
            <HelpCircle className="w-3 h-3 text-blue-800 opacity-70 ml-0.5" />
          </button>
        );
      case 'robots_disallowed':
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPolicyModal(page);
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-900 border border-purple-300 hover:opacity-85 transition-opacity cursor-pointer group"
            title="Click to see robots.txt policy details"
          >
            <span aria-hidden="true">🤖</span>
            <span>Robots disallowed</span>
            <HelpCircle className="w-3 h-3 text-purple-800 opacity-70 ml-0.5" />
          </button>
        );
      case 'empty':
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPolicyModal(page);
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300 hover:opacity-85 transition-opacity cursor-pointer group"
            title="Click to see empty content policy details"
          >
            <span aria-hidden="true">⚠️</span>
            <span>Sparse/Empty content</span>
            <HelpCircle className="w-3 h-3 text-gray-700 opacity-70 ml-0.5" />
          </button>
        );
      case 'timeout':
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPolicyModal(page);
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-900 border border-rose-300 hover:opacity-85 transition-opacity cursor-pointer group"
            title="Click to see timeout policy details"
          >
            <span aria-hidden="true">⏱</span>
            <span>Timeout</span>
            <HelpCircle className="w-3 h-3 text-rose-800 opacity-70 ml-0.5" />
          </button>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
            <span aria-hidden="true">❓</span>
            <span>{page.page_status}</span>
          </span>
        );
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            High Severity
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
            Medium Severity
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
            Low Severity
          </span>
        );
    }
  };

  // Grouped counts by verified categories (no overall grade or safety score)
  const categoryCounts = {
    hidden_charges: scan.grouped_findings.filter((f) => f.category === 'hidden_charges').length,
    cancellation: scan.grouped_findings.filter((f) => f.category === 'cancellation').length,
    consent: scan.grouped_findings.filter((f) => f.category === 'consent').length,
  };

  const filteredFindings = selectedFilter
    ? scan.grouped_findings.filter((f) => f.category === selectedFilter)
    : scan.grouped_findings;

  return (
    <div className="w-full space-y-8 animate-fadeIn">
      {/* Header Bar */}
      <div className="bg-white rounded-sm p-6 border border-border-hairline shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wider font-mono font-semibold text-ink-muted">
                Multi-Page Site Audit
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-paper text-ink font-mono border border-border-hairline">
                {scan.status.toUpperCase()}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif text-ink break-all">
              {scan.root_url}
            </h2>
            <p className="text-xs text-ink-muted mt-1 font-mono">
              Scanned on {new Date(scan.created_at).toLocaleString()} • Concurrency: 1 • Delay: 1.0s
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-ink-muted block">Audited pages</span>
            <span className="text-2xl font-bold font-mono text-ink">
              {scan.coverage.pages_analysed}
              <span className="text-sm font-normal text-ink-muted"> / {scan.coverage.pages_discovered} found</span>
            </span>
          </div>
        </div>
      </div>

      {/* Category Summary Tiles (Raw counts only - strictly no site score or grade) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setSelectedFilter(selectedFilter === 'hidden_charges' ? null : 'hidden_charges')}
          className={`p-5 rounded-sm bg-white border text-left transition-all ${
            selectedFilter === 'hidden_charges'
              ? 'border-red-pen ring-1 ring-red-pen'
              : 'border-border-hairline hover:border-ink-muted:border-[#4b4736]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Hidden charges
            </span>
            <CreditCard className="w-5 h-5 text-red-pen" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-ink">
            {categoryCounts.hidden_charges}
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Mandatory fees or surcharges withheld until payment
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter(selectedFilter === 'cancellation' ? null : 'cancellation')}
          className={`p-5 rounded-sm bg-white border text-left transition-all ${
            selectedFilter === 'cancellation'
              ? 'border-red-pen ring-1 ring-red-pen'
              : 'border-border-hairline hover:border-ink-muted:border-[#4b4736]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Cancellation
            </span>
            <Ban className="w-5 h-5 text-ink-muted" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-ink">
            {categoryCounts.cancellation}
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Concealed cancellation paths or asymmetric retention steps
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter(selectedFilter === 'consent' ? null : 'consent')}
          className={`p-5 rounded-sm bg-white border text-left transition-all ${
            selectedFilter === 'consent'
              ? 'border-red-pen ring-1 ring-red-pen'
              : 'border-border-hairline hover:border-ink-muted:border-[#4b4736]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Consent choices
            </span>
            <CheckSquare className="w-5 h-5 text-ink" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-ink">
            {categoryCounts.consent}
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Pre-ticked opt-ins or visually asymmetric consent controls
          </p>
        </button>
      </div>

      {/* Mandatory COVERAGE Panel */}
      <section
        id="coverage-panel"
        aria-labelledby="coverage-heading"
        className="bg-white rounded-sm p-6 border border-border-hairline shadow-none space-y-4"
      >
        <div className="flex items-center justify-between border-b border-border-hairline pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-ink" aria-hidden="true" />
            <h3 id="coverage-heading" className="text-lg font-bold font-serif text-ink">
              Coverage &amp; Inspection Scope
            </h3>
          </div>
          <Link
            to="/methodology#limits"
            className="text-xs font-medium text-ink hover:underline inline-flex items-center gap-1"
          >
            <span>Methodology limits</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Mandatory Disclosure Alert */}
        <div className="p-4 rounded-sm bg-paper border-l-4 border-ink text-sm text-ink">
          <p className="font-semibold">
            Results cover only the pages reached. No findings does not mean the whole site is fair.
          </p>
          <p className="text-xs text-ink-muted mt-1">
            Pages requiring user accounts, payment credentials, or excluded by bot protection were not audited. Review unreached areas manually.
          </p>
        </div>

        {/* Coverage Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-sm bg-paper/60 border border-border-hairline">
            <span className="text-xs text-ink-muted block">Pages Discovered</span>
            <span className="text-xl font-bold font-mono text-ink">
              {scan.coverage.pages_discovered}
            </span>
          </div>
          <div className="p-3 rounded-sm bg-paper/60 border border-border-hairline">
            <span className="text-xs text-ink-muted block">Pages Analysed</span>
            <span className="text-xl font-bold font-mono text-ink">
              {scan.coverage.pages_analysed}
            </span>
          </div>
          <div className="p-3 rounded-sm bg-paper/60 border border-border-hairline">
            <span className="text-xs text-ink-muted block">AI Inspected</span>
            <span className="text-xl font-bold font-mono text-ink">
              {scan.coverage.pages_ai_analysed}
              <span className="text-xs font-normal text-ink-muted"> ({scan.coverage.ai_calls_used} calls)</span>
            </span>
          </div>
          <div className="p-3 rounded-sm bg-paper/60 border border-border-hairline">
            <span className="text-xs text-ink-muted block">Blocked / Auth Needed</span>
            <span className="text-xl font-bold font-mono text-amber-700">
              {scan.coverage.pages_blocked + scan.coverage.pages_needs_login}
            </span>
          </div>
        </div>

        {/* Key Transactional Areas Reached */}
        <div className="pt-2 text-xs text-ink-muted flex flex-wrap gap-4">
          <div>
            <span className="font-semibold text-ink">Key areas discovered: </span>
            <span>{scan.coverage.key_page_types_found.join(', ') || 'None found'}</span>
          </div>
          <div>
            <span className="font-semibold text-ink">Key areas reached: </span>
            <span>{scan.coverage.key_page_types_reached.join(', ') || 'None reached'}</span>
          </div>
        </div>

        {/* Skipped Reason Breakdown */}
        {Object.keys(scan.coverage.pages_skipped_by_reason).length > 0 && (
          <div className="pt-2 text-xs border-t border-border-hairline">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-ink">
                Pages skipped by policy:
              </span>
              <span className="text-[11px] text-ink-muted">
                Click any policy category to see why
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(scan.coverage.pages_skipped_by_reason).map(([reason, count]) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => handleOpenPolicyCategory(reason)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-paper border border-border-hairline text-ink hover:border-ink hover:bg-white transition-all cursor-pointer text-xs group"
                  title={`Click to see why pages were skipped under ${reason}`}
                >
                  <span className="font-mono font-medium text-ink">{count}</span>
                  <span className="capitalize">{reason.replace('skipped_', '').replace('_', ' ')}</span>
                  <HelpCircle className="w-3 h-3 text-ink-muted group-hover:text-ink opacity-70" />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Grouped Findings Section */}
      <section aria-labelledby="findings-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="findings-heading" className="text-lg font-bold font-serif text-ink">
            Verified Interface Findings ({filteredFindings.length})
          </h3>
          {selectedFilter && (
            <button
              onClick={() => setSelectedFilter(null)}
              className="text-xs text-red-pen hover:underline cursor-pointer"
            >
              Clear filter ({selectedFilter})
            </button>
          )}
        </div>

        {filteredFindings.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-sm border border-border-hairline">
            <p className="text-sm font-medium text-ink">
              No deceptive patterns flagged on the {scan.coverage.pages_analysed} pages reached.
            </p>
            <p className="text-xs text-ink-muted mt-1">
              Remember: this does not guarantee unreached areas (or areas behind checkout/login) are free of dark patterns.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFindings.map((finding, idx) => {
              const isExpanded = !!expandedFindings[idx];
              return (
                <div
                  key={`${finding.type}-${idx}`}
                  className="bg-white rounded-sm border border-border-hairline p-5 shadow-none transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getSeverityBadge(finding.severity)}
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-paper text-ink border border-border-hairline">
                          {finding.type}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                          Seen on {finding.pages.length} page{finding.pages.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <h4 className="text-base font-semibold text-ink pt-1">
                        {finding.why}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFinding(idx)}
                      className="self-start text-xs font-medium text-ink hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide details' : 'View evidence & pages'}</span>
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Expanded View */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border-hairline space-y-4 text-xs sm:text-sm">
                      {/* Evidence & Quote */}
                      <div className="p-3 bg-paper rounded-sm space-y-1">
                        <span className="font-mono text-xs uppercase font-semibold text-ink-muted block">
                          Measured Evidence:
                        </span>
                        <p className="font-mono text-xs text-ink break-words">
                          {finding.evidence}
                        </p>
                      </div>

                      {/* Safer Design Recommendation */}
                      <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-sm">
                        <span className="font-semibold text-emerald-900 block mb-1">
                          Safer Design Alternative:
                        </span>
                        <p className="text-emerald-800">
                          {finding.safer_alternative}
                        </p>
                      </div>

                      {/* Pages List */}
                      <div>
                        <span className="font-semibold text-ink block mb-2">
                          Discovered on these URLs:
                        </span>
                        <ul className="space-y-1">
                          {finding.pages.map((pUrl, pIdx) => (
                            <li key={pIdx} className="font-mono text-xs text-ink-muted flex items-center gap-1.5">
                              <span>•</span>
                              <span className="break-all">{pUrl}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Visual Page Inspector: Page Screenshots & Proof Marker Pins */}
      <section id="visual-page-inspector" aria-labelledby="inspector-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-hairline pb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-red-pen" aria-hidden="true" />
            <h3 id="inspector-heading" className="text-lg font-bold font-serif text-ink">
              Visual Page Inspector · Screenshots &amp; Dark Pattern Proof Pins
            </h3>
          </div>
          <span className="text-xs font-mono text-ink-muted">
            Click any pin or yellow box on the screenshot to inspect the dark pattern
          </span>
        </div>

        {/* Audited Page Switcher Tabs */}
        {scan.pages.filter((p) => (p.screenshot_base64 && p.screenshot_base64.trim().length > 0) || p.decision === 'will_analyse').length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-mono text-ink-muted">
              Select an audited page to inspect screenshot and proof markers:
            </div>
            <div className="flex flex-wrap gap-2">
              {scan.pages
                .filter((p) => (p.screenshot_base64 && p.screenshot_base64.trim().length > 0) || p.decision === 'will_analyse')
                .map((p, idx) => {
                  const isSelected = p.url === selectedPageUrl;
                  return (
                    <button
                      key={p.url}
                      type="button"
                      onClick={() => {
                        setSelectedPageUrl(p.url);
                        setSelectedFindingIndex(null);
                      }}
                      className={`px-3 py-2 rounded-sm text-xs font-medium border transition-all flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-ink text-paper border-ink shadow-none font-semibold'
                          : 'bg-white text-ink border-border-hairline hover:border-ink-muted:border-[#4b4736]'
                      }`}
                    >
                      <span className="font-mono opacity-80">#{idx + 1}</span>
                      <span className="capitalize">{p.page_type}</span>
                      <span className="font-mono text-[11px] opacity-75 max-w-[140px] truncate">
                        {p.url.replace(/^https?:\/\/[^/]+/i, '') || '/'}
                      </span>
                      {p.findings.length > 0 ? (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            isSelected ? 'bg-red-pen text-white' : 'bg-red-tint text-red-pen'
                          }`}
                        >
                          {p.findings.length}
                        </span>
                      ) : (
                        <span className="text-[10px] opacity-60">Clean</span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Interactive Viewer Container */}
        {(() => {
          const activePage =
            scan.pages.find((p) => p.url === selectedPageUrl) ||
            scan.pages.find((p) => p.page_status === 'ok') ||
            scan.pages[0];

          if (!activePage) return null;

          return (
            <div className="space-y-4">
              <div className="bg-paper/60 p-3 rounded-sm border border-border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-ink">Viewing:</span>
                  <span className="font-mono text-ink truncate">{activePage.url}</span>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-outline-variant/40 font-mono text-ink-muted">
                    {activePage.page_type}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-ink-muted">Page findings:</span>
                  <span className="font-bold font-mono text-ink">
                    {activePage.findings.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Screenshot Viewer (8 cols on large screen) */}
                <div className="lg:col-span-8 min-h-[520px]">
                  <ScreenshotViewer
                    screenshotBase64={activePage.screenshot_base64}
                    url={activePage.url}
                    findings={activePage.findings}
                    selectedFindingIndex={selectedFindingIndex}
                    onSelectFinding={(idx) =>
                      setSelectedFindingIndex(idx === selectedFindingIndex ? null : idx)
                    }
                  />
                </div>

                {/* Finding Proof Margin Notes (4 cols on large screen) */}
                <div className="lg:col-span-4 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-border-hairline">
                    <span className="font-mono text-xs uppercase font-semibold text-ink-muted">
                      Page Proof Annotations ({activePage.findings.length})
                    </span>
                    {selectedFindingIndex !== null && (
                      <button
                        type="button"
                        onClick={() => setSelectedFindingIndex(null)}
                        className="text-xs text-red-pen hover:underline cursor-pointer"
                      >
                        Reset view
                      </button>
                    )}
                  </div>

                  {activePage.findings.length === 0 ? (
                    <div className="p-6 text-center bg-white rounded-sm border border-border-hairline text-xs text-ink-muted">
                      <p className="font-semibold text-ink">Clean page layout</p>
                      <p className="mt-1">No deceptive dark pattern markers were flagged on this page.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                      {activePage.findings.map((f, fIdx) => {
                        const isSelected = selectedFindingIndex === fIdx;
                        return (
                          <div
                            key={fIdx}
                            onClick={() => setSelectedFindingIndex(isSelected ? null : fIdx)}
                            className={`p-3.5 rounded-sm border transition-all cursor-pointer ${
                              isSelected
                                ? 'border-red-pen bg-red-tint/10 shadow-none ring-1 ring-red-pen'
                                : 'bg-white border-border-hairline hover:border-ink-muted:border-[#4b4736]'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="proof-marker text-xs w-5 h-5 leading-4 border-red-pen text-red-pen shrink-0">
                                #{fIdx + 1}
                              </span>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-semibold text-xs text-ink truncate">
                                    {f.type}
                                  </span>
                                  {getSeverityBadge(f.severity)}
                                </div>
                                <p className="text-[11px] font-mono text-ink line-clamp-2 bg-paper p-1.5 rounded border border-border-hairline">
                                  "{f.evidence}"
                                </p>
                                <p className="text-[11px] text-ink-muted line-clamp-2">
                                  {f.why}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* Discovered Pages Table */}
      <section aria-labelledby="pages-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="pages-heading" className="text-lg font-bold font-serif text-ink">
            Discovered Pages ({scan.pages.length} total • {scan.coverage.pages_analysed} analysed, {scan.pages.length - scan.coverage.pages_analysed} skipped)
          </h3>
          <button
            onClick={() => setExpandedPages(!expandedPages)}
            className="text-xs font-medium text-ink hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{expandedPages ? 'Collapse' : 'Expand'}</span>
            {expandedPages ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {expandedPages && (
          <div className="bg-white rounded-sm border border-border-hairline overflow-hidden shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border-hairline bg-paper text-ink-muted">
                    <th className="p-3 font-semibold">Page URL</th>
                    <th className="p-3 font-semibold">Type</th>
                    <th className="p-3 font-semibold">Decision / Status</th>
                    <th className="p-3 font-semibold">Findings</th>
                    <th className="p-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline">
                  {scan.pages.map((p, idx) => (
                    <tr key={idx} className="hover:bg-paper/50:bg-[#211f1e]/60 transition-colors">
                      <td className="p-3 font-mono text-xs text-ink break-all max-w-[280px]">
                        {p.url}
                        {p.status_reason && (p.page_status !== 'ok' || p.decision !== 'will_analyse') && (
                          <span className="block text-[11px] text-ink-muted font-sans mt-0.5">
                            {p.status_reason}
                          </span>
                        )}
                      </td>
                      <td className="p-3 capitalize font-medium text-ink">
                        {p.page_type}
                      </td>
                      <td className="p-3">
                        {getPageStatusBadge(p)}
                      </td>
                      <td className="p-3 font-mono">
                        {p.findings.length > 0 ? (
                          <span className="text-red-pen font-semibold">{p.findings.length}</span>
                        ) : (
                          <span className="text-ink-muted">0</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {p.page_status === 'blocked' || p.page_status === 'needs_login' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenPolicyModal(p)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-border-hairline text-ink hover:bg-paper cursor-pointer"
                              title="Why this page was blocked"
                            >
                              <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                              <span>Why</span>
                            </button>
                            <button
                              type="button"
                              onClick={onOpenUpload}
                              className="px-2 py-1 rounded text-xs font-medium bg-ink text-paper hover:opacity-90 transition-opacity"
                              title="Upload saved HTML or screenshot"
                            >
                              Upload
                            </button>
                            <button
                              type="button"
                              onClick={() => onStartFlow && onStartFlow(p.url)}
                              className="px-2 py-1 rounded text-xs font-medium border border-border-hairline text-ink hover:bg-paper:bg-[#211f1e]"
                              title="Scripted checkout flow"
                            >
                              Flow
                            </button>
                          </div>
                        ) : (p.screenshot_base64 && p.screenshot_base64.trim().length > 0) || (p.decision === 'will_analyse' && p.page_status === 'ok') ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPageUrl(p.url);
                              setSelectedFindingIndex(null);
                              document.getElementById('visual-page-inspector')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-white text-ink border border-border-hairline hover:border-ink hover:shadow-none transition-all cursor-pointer"
                            title="Inspect page screenshot and proof markers"
                          >
                            <Camera className="w-3.5 h-3.5 text-red-pen" />
                            <span>Inspect Screenshot</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenPolicyModal(p)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-white text-ink border border-border-hairline hover:border-ink hover:shadow-none transition-all cursor-pointer"
                            title="See why this page was skipped by policy"
                          >
                            <HelpCircle className="w-3.5 h-3.5 text-ink-muted" />
                            <span>See why</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Policy Explanation Modal */}
      <PolicyExplanationModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        data={policyModalData}
        onAnalyzePage={onAnalyzeSinglePage}
      />
    </div>
  );
};
