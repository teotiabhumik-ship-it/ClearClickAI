import React from 'react';
import { Loader2, XCircle, AlertCircle, CheckCircle, Shield, Globe } from 'lucide-react';
import { Scan } from '../types';

interface SiteScanProgressProps {
  scan: Scan;
  onCancel: () => void;
  isCancelling?: boolean;
}

export const SiteScanProgress: React.FC<SiteScanProgressProps> = ({
  scan,
  onCancel,
  isCancelling = false,
}) => {
  const discovered = scan.coverage.pages_discovered || scan.pages.length;
  const analysed = scan.coverage.pages_analysed;
  const blocked = scan.coverage.pages_blocked;
  const needsLogin = scan.coverage.pages_needs_login;

  return (
    <div className="w-full bg-white rounded-sm p-6 border border-border-hairline shadow-none space-y-6 animate-fadeIn">
      {/* Header and Live Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-hairline pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Loader2 className="w-4 h-4 text-ink animate-spin" aria-hidden="true" />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-muted">
              Multi-Page Audit in Progress
            </span>
          </div>
          <h2 className="text-xl font-bold font-serif text-ink break-all">
            {scan.root_url}
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Polite crawling: 1 request/domain, 1.0s delay, obeying robots.txt
          </p>
        </div>

        {/* Cancel Button (as prominent and visible as other actions) */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling || scan.status === 'completed' || scan.status === 'cancelled'}
          className="h-10 px-4 rounded-sm border-2 border-red-pen text-red-pen hover:bg-red-pen hover:text-white:bg-[#8d1610]:text-[#ffb4a9] text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" aria-hidden="true" />
          <span>{isCancelling ? 'Stopping scan...' : 'Cancel Scan'}</span>
        </button>
      </div>

      {/* Live Counts Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-sm bg-paper border border-border-hairline">
          <span className="text-xs text-ink-muted block">Discovered</span>
          <span className="text-xl font-bold font-mono text-ink">
            {discovered} found
          </span>
        </div>
        <div className="p-3 rounded-sm bg-paper border border-border-hairline">
          <span className="text-xs text-ink-muted block">Deep Analysis</span>
          <span className="text-xl font-bold font-mono text-ink">
            {analysed} analysed
          </span>
        </div>
        <div className="p-3 rounded-sm bg-paper border border-border-hairline">
          <span className="text-xs text-ink-muted block">Blocked</span>
          <span className="text-xl font-bold font-mono text-amber-700">
            {blocked} blocked
          </span>
        </div>
        <div className="p-3 rounded-sm bg-paper border border-border-hairline">
          <span className="text-xs text-ink-muted block">Login Walls</span>
          <span className="text-xl font-bold font-mono text-blue-700">
            {needsLogin} login
          </span>
        </div>
      </div>

      {/* Step / Page Stream List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink flex items-center justify-between">
          <span>Inspection Queue ({scan.pages.length} processed)</span>
          <span className="text-xs text-ink-muted font-normal">
            Results update in real-time
          </span>
        </h3>

        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
          {scan.pages.map((p, idx) => (
            <div
              key={idx}
              className="p-3 rounded-sm bg-paper/60 border border-border-hairline flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold uppercase tracking-wider text-[11px] px-1.5 py-0.5 rounded bg-paper text-ink">
                    {p.page_type}
                  </span>
                  <span className="font-mono text-ink truncate">
                    {p.url}
                  </span>
                </div>
                {p.status_reason && (
                  <p className="text-[11px] text-ink-muted mt-0.5 truncate">
                    {p.status_reason}
                  </p>
                )}
              </div>

              <div className="shrink-0">
                {p.page_status === 'ok' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <span>✓</span>
                    <span>{p.findings.length} findings</span>
                  </span>
                ) : p.page_status === 'blocked' ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                    <span>⛔</span>
                    <span>Blocked</span>
                  </span>
                ) : p.page_status === 'needs_login' ? (
                  <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                    <span>🔒</span>
                    <span>Login</span>
                  </span>
                ) : (
                  <span className="text-ink-muted">
                    {p.page_status}
                  </span>
                )}
              </div>
            </div>
          ))}

          {scan.pages.length === 0 && (
            <div className="text-center py-8 text-ink-muted text-xs">
              Fetching robots.txt and sitemaps to discover prioritized pages...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
