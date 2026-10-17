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
  PlayCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Scan, ScanPage, GroupedFinding } from '../types';

interface ScanReportViewProps {
  scan: Scan;
  onOpenUpload?: () => void;
  onStartFlow?: (url: string) => void;
}

export const ScanReportView: React.FC<ScanReportViewProps> = ({
  scan,
  onOpenUpload,
  onStartFlow,
}) => {
  const [expandedFindings, setExpandedFindings] = useState<Record<number, boolean>>({});
  const [expandedPages, setExpandedPages] = useState<boolean>(true);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const toggleFinding = (idx: number) => {
    setExpandedFindings((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getPageStatusBadge = (page: ScanPage) => {
    switch (page.page_status) {
      case 'ok':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <span aria-hidden="true">✓</span>
            <span>Analysed</span>
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <span aria-hidden="true">⛔</span>
            <span>Blocked by site</span>
          </span>
        );
      case 'needs_login':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <span aria-hidden="true">🔒</span>
            <span>Requires login</span>
          </span>
        );
      case 'robots_disallowed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
            <span aria-hidden="true">🤖</span>
            <span>Robots disallowed</span>
          </span>
        );
      case 'empty':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-700">
            <span aria-hidden="true">⚠️</span>
            <span>Sparse/Empty content</span>
          </span>
        );
      case 'timeout':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <span aria-hidden="true">⏱</span>
            <span>Timeout</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-700">
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
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            High Severity
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            Medium Severity
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
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
      <div className="bg-white dark:bg-[#111A2E] rounded-sm p-6 border border-border-hairline dark:border-[#26324A] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wider font-mono font-semibold text-ink-muted dark:text-[#94A3B8]">
                Multi-Page Site Audit
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-paper dark:bg-[#0B1220] text-ink font-mono border border-border-hairline dark:border-[#26324A]">
                {scan.status.toUpperCase()}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif text-ink dark:text-[#E2E8F0] break-all">
              {scan.root_url}
            </h2>
            <p className="text-xs text-ink-muted dark:text-[#94A3B8] mt-1 font-mono">
              Scanned on {new Date(scan.created_at).toLocaleString()} • Concurrency: 1 • Delay: 1.0s
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-ink-muted dark:text-[#94A3B8] block">Audited pages</span>
            <span className="text-2xl font-bold font-mono text-ink dark:text-[#2DD4BF]">
              {scan.coverage.pages_analysed}
              <span className="text-sm font-normal text-ink-muted dark:text-[#94A3B8]"> / {scan.coverage.pages_discovered} found</span>
            </span>
          </div>
        </div>
      </div>

      {/* Category Summary Tiles (Raw counts only - strictly no site score or grade) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setSelectedFilter(selectedFilter === 'hidden_charges' ? null : 'hidden_charges')}
          className={`p-5 rounded-sm bg-white dark:bg-[#111A2E] border text-left transition-all ${
            selectedFilter === 'hidden_charges'
              ? 'border-red-pen ring-1 ring-red-pen'
              : 'border-border-hairline dark:border-[#26324A] hover:border-ink-muted'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-[#94A3B8]">
              Hidden charges
            </span>
            <CreditCard className="w-5 h-5 text-red-pen" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-ink dark:text-[#E2E8F0]">
            {categoryCounts.hidden_charges}
          </div>
          <p className="text-xs text-ink-muted dark:text-[#94A3B8] mt-1">
            Mandatory fees or surcharges withheld until payment
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter(selectedFilter === 'cancellation' ? null : 'cancellation')}
          className={`p-5 rounded-sm bg-white dark:bg-[#111A2E] border text-left transition-all ${
            selectedFilter === 'cancellation'
              ? 'border-red-pen ring-1 ring-red-pen'
              : 'border-border-hairline dark:border-[#26324A] hover:border-ink-muted'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-[#94A3B8]">
              Cancellation
            </span>
            <Ban className="w-5 h-5 text-ink-muted dark:text-[#94A3B8]" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-ink dark:text-[#E2E8F0]">
            {categoryCounts.cancellation}
          </div>
          <p className="text-xs text-ink-muted dark:text-[#94A3B8] mt-1">
            Concealed cancellation paths or asymmetric retention steps
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter(selectedFilter === 'consent' ? null : 'consent')}
          className={`p-5 rounded-sm bg-white dark:bg-[#111A2E] border text-left transition-all ${
            selectedFilter === 'consent'
              ? 'border-red-pen ring-1 ring-red-pen'
              : 'border-border-hairline dark:border-[#26324A] hover:border-ink-muted'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-[#94A3B8]">
              Consent choices
            </span>
            <CheckSquare className="w-5 h-5 text-ink dark:text-[#2DD4BF]" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-ink dark:text-[#E2E8F0]">
            {categoryCounts.consent}
          </div>
          <p className="text-xs text-ink-muted dark:text-[#94A3B8] mt-1">
            Pre-ticked opt-ins or visually asymmetric consent controls
          </p>
        </button>
      </div>

      {/* Mandatory COVERAGE Panel */}
      <section
        id="coverage-panel"
        aria-labelledby="coverage-heading"
        className="bg-white dark:bg-[#111A2E] rounded-sm p-6 border border-border-hairline dark:border-[#26324A] shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between border-b border-border-hairline dark:border-[#26324A] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-ink dark:text-[#2DD4BF]" aria-hidden="true" />
            <h3 id="coverage-heading" className="text-lg font-bold font-serif text-ink dark:text-[#E2E8F0]">
              Coverage & Inspection Scope
            </h3>
          </div>
          <Link
            to="/methodology#limits"
            className="text-xs font-medium text-ink dark:text-[#2DD4BF] hover:underline inline-flex items-center gap-1"
          >
            <span>Methodology limits</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Mandatory Disclosure Alert */}
        <div className="p-4 rounded-sm bg-paper dark:bg-[#0B1220] border-l-4 border-ink dark:border-[#2DD4BF] text-sm text-ink dark:text-[#E2E8F0]">
          <p className="font-semibold">
            Results cover only the pages reached. No findings does not mean the whole site is fair.
          </p>
          <p className="text-xs text-ink-muted dark:text-[#94A3B8] mt-1">
            Pages requiring user accounts, payment credentials, or excluded by bot protection were not audited. Review unreached areas manually.
          </p>
        </div>

        {/* Coverage Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-sm bg-paper/60 dark:bg-[#0B1220]/60 border border-border-hairline dark:border-[#26324A]">
            <span className="text-xs text-ink-muted dark:text-[#94A3B8] block">Pages Discovered</span>
            <span className="text-xl font-bold font-mono text-ink dark:text-[#E2E8F0]">
              {scan.coverage.pages_discovered}
            </span>
          </div>
          <div className="p-3 rounded-sm bg-paper/60 dark:bg-[#0B1220]/60 border border-border-hairline dark:border-[#26324A]">
            <span className="text-xs text-ink-muted dark:text-[#94A3B8] block">Pages Analysed</span>
            <span className="text-xl font-bold font-mono text-ink dark:text-[#2DD4BF]">
              {scan.coverage.pages_analysed}
            </span>
          </div>
          <div className="p-3 rounded-sm bg-paper/60 dark:bg-[#0B1220]/60 border border-border-hairline dark:border-[#26324A]">
            <span className="text-xs text-ink-muted dark:text-[#94A3B8] block">AI Inspected</span>
            <span className="text-xl font-bold font-mono text-ink dark:text-[#E2E8F0]">
              {scan.coverage.pages_ai_analysed}
              <span className="text-xs font-normal text-ink-muted dark:text-[#94A3B8]"> ({scan.coverage.ai_calls_used} calls)</span>
            </span>
          </div>
          <div className="p-3 rounded-sm bg-paper/60 dark:bg-[#0B1220]/60 border border-border-hairline dark:border-[#26324A]">
            <span className="text-xs text-ink-muted dark:text-[#94A3B8] block">Blocked / Auth Needed</span>
            <span className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400">
              {scan.coverage.pages_blocked + scan.coverage.pages_needs_login}
            </span>
          </div>
        </div>

        {/* Key Transactional Areas Reached */}
        <div className="pt-2 text-xs text-ink-muted dark:text-[#94A3B8] flex flex-wrap gap-4">
          <div>
            <span className="font-semibold text-ink dark:text-[#E2E8F0]">Key areas discovered: </span>
            <span>{scan.coverage.key_page_types_found.join(', ') || 'None found'}</span>
          </div>
          <div>
            <span className="font-semibold text-ink dark:text-[#E2E8F0]">Key areas reached: </span>
            <span>{scan.coverage.key_page_types_reached.join(', ') || 'None reached'}</span>
          </div>
        </div>

        {/* Skipped Reason Breakdown */}
        {Object.keys(scan.coverage.pages_skipped_by_reason).length > 0 && (
          <div className="pt-2 text-xs border-t border-border-hairline dark:border-[#26324A]">
            <span className="font-semibold text-ink dark:text-[#E2E8F0] block mb-1">
              Pages skipped by policy:
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(scan.coverage.pages_skipped_by_reason).map(([reason, count]) => (
                <span
                  key={reason}
                  className="px-2 py-1 rounded bg-paper dark:bg-[#0B1220] border border-border-hairline dark:border-[#26324A] text-ink-muted dark:text-[#94A3B8]"
                >
                  <span className="font-mono font-medium text-ink dark:text-[#E2E8F0]">{count}</span> {reason.replace('skipped_', '').replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Grouped Findings Section */}
      <section aria-labelledby="findings-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="findings-heading" className="text-lg font-bold font-serif text-ink dark:text-[#E2E8F0]">
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
          <div className="p-8 text-center bg-white dark:bg-[#111A2E] rounded-sm border border-border-hairline dark:border-[#26324A]">
            <p className="text-sm font-medium text-ink dark:text-[#E2E8F0]">
              No deceptive patterns flagged on the {scan.coverage.pages_analysed} pages reached.
            </p>
            <p className="text-xs text-ink-muted dark:text-[#94A3B8] mt-1">
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
                  className="bg-white dark:bg-[#111A2E] rounded-sm border border-border-hairline dark:border-[#26324A] p-5 shadow-sm transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getSeverityBadge(finding.severity)}
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-paper dark:bg-[#0B1220] text-ink dark:text-[#94A3B8] border border-border-hairline dark:border-[#26324A]">
                          {finding.type}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          Seen on {finding.pages.length} page{finding.pages.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <h4 className="text-base font-semibold text-ink dark:text-[#E2E8F0] pt-1">
                        {finding.why}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFinding(idx)}
                      className="self-start text-xs font-medium text-ink dark:text-[#2DD4BF] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide details' : 'View evidence & pages'}</span>
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Expanded View */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border-hairline dark:border-[#26324A] space-y-4 text-xs sm:text-sm">
                      {/* Evidence & Quote */}
                      <div className="p-3 bg-paper dark:bg-[#0B1220] rounded-sm space-y-1">
                        <span className="font-mono text-xs uppercase font-semibold text-ink-muted dark:text-[#94A3B8] block">
                          Measured Evidence:
                        </span>
                        <p className="font-mono text-xs text-ink dark:text-[#E2E8F0] break-words">
                          {finding.evidence}
                        </p>
                      </div>

                      {/* Safer Design Recommendation */}
                      <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-sm">
                        <span className="font-semibold text-emerald-900 dark:text-emerald-300 block mb-1">
                          Safer Design Alternative:
                        </span>
                        <p className="text-emerald-800 dark:text-emerald-400">
                          {finding.safer_alternative}
                        </p>
                      </div>

                      {/* Pages List */}
                      <div>
                        <span className="font-semibold text-ink dark:text-[#E2E8F0] block mb-2">
                          Discovered on these URLs:
                        </span>
                        <ul className="space-y-1">
                          {finding.pages.map((pUrl, pIdx) => (
                            <li key={pIdx} className="font-mono text-xs text-ink-muted dark:text-[#94A3B8] flex items-center gap-1.5">
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

      {/* Audited Pages Table */}
      <section aria-labelledby="pages-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="pages-heading" className="text-lg font-bold font-serif text-ink dark:text-[#E2E8F0]">
            All Site Pages Checked ({scan.pages.length})
          </h3>
          <button
            onClick={() => setExpandedPages(!expandedPages)}
            className="text-xs font-medium text-ink dark:text-[#2DD4BF] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{expandedPages ? 'Collapse' : 'Expand'}</span>
            {expandedPages ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {expandedPages && (
          <div className="bg-white dark:bg-[#111A2E] rounded-sm border border-border-hairline dark:border-[#26324A] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border-hairline dark:border-[#26324A] bg-paper dark:bg-[#0B1220] text-ink-muted dark:text-[#94A3B8]">
                    <th className="p-3 font-semibold">Page URL</th>
                    <th className="p-3 font-semibold">Type</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Findings</th>
                    <th className="p-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline dark:divide-[#26324A]">
                  {scan.pages.map((p, idx) => (
                    <tr key={idx} className="hover:bg-paper/50 dark:hover:bg-[#0B1220]/50 transition-colors">
                      <td className="p-3 font-mono text-xs text-ink dark:text-[#E2E8F0] break-all max-w-[280px]">
                        {p.url}
                        {p.status_reason && p.page_status !== 'ok' && (
                          <span className="block text-[11px] text-ink-muted dark:text-[#94A3B8] font-sans mt-0.5">
                            {p.status_reason}
                          </span>
                        )}
                      </td>
                      <td className="p-3 capitalize font-medium text-ink dark:text-[#E2E8F0]">
                        {p.page_type}
                      </td>
                      <td className="p-3">
                        {getPageStatusBadge(p)}
                      </td>
                      <td className="p-3 font-mono">
                        {p.findings.length > 0 ? (
                          <span className="text-red-pen font-semibold">{p.findings.length}</span>
                        ) : (
                          <span className="text-ink-muted dark:text-[#94A3B8]">0</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {p.page_status === 'blocked' || p.page_status === 'needs_login' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={onOpenUpload}
                              className="px-2 py-1 rounded text-xs font-medium bg-ink dark:bg-[#2DD4BF] text-paper dark:text-[#0B1220] hover:opacity-90 transition-opacity"
                              title="Upload saved HTML or screenshot"
                            >
                              Upload
                            </button>
                            <button
                              type="button"
                              onClick={() => onStartFlow && onStartFlow(p.url)}
                              className="px-2 py-1 rounded text-xs font-medium border border-border-hairline dark:border-[#26324A] text-ink dark:text-[#E2E8F0] hover:bg-paper dark:hover:bg-[#0B1220]"
                              title="Scripted checkout flow"
                            >
                              Flow
                            </button>
                          </div>
                        ) : (
                          <span className="text-ink-muted dark:text-[#94A3B8] text-xs">—</span>
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
    </div>
  );
};
