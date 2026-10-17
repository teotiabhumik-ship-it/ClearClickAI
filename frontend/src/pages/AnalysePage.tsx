import React, { useState, useEffect, useRef } from 'react';
import { AnalysisReport, CorpusItem, Scan, GuidedFlowResult } from '../types';
import { InputForm } from '../components/InputForm';
import { ScreenshotViewer } from '../components/ScreenshotViewer';
import { FindingsPanel } from '../components/FindingsPanel';
import { ScanReportView } from '../components/ScanReportView';
import { SiteScanProgress } from '../components/SiteScanProgress';
import { AlertCircle, X, Server, ShieldAlert, UploadCloud, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildApiUrl } from '../config/api';
import corpusCatalog from '../data/corpusCatalog.json';
import sampleReports from '../data/sampleReports.json';
import { ServerSettingsModal } from '../components/ServerSettingsModal';

export const AnalysePage: React.FC = () => {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [activeScan, setActiveScan] = useState<Scan | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [corpusList, setCorpusList] = useState<CorpusItem[]>(corpusCatalog as CorpusItem[]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFindingIndex, setSelectedFindingIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showInputForm, setShowInputForm] = useState<boolean>(true);
  const [isServerModalOpen, setIsServerModalOpen] = useState<boolean>(false);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const scanPollTimeoutRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  // Clean up any pending analysis request or polling on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      analyzeAbortRef.current?.abort();
      if (scanPollTimeoutRef.current) {
        clearTimeout(scanPollTimeoutRef.current);
      }
    };
  }, []);

  // Synchronize corpus catalog with live backend if reachable
  useEffect(() => {
    const controller = new AbortController();
    fetch(buildApiUrl('/api/corpus'), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Offline or static mode');
        return res.json();
      })
      .then((data: CorpusItem[]) => {
        if (isMountedRef.current && Array.isArray(data) && data.length > 0) {
          setCorpusList(data);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          // Pre-bundled corpus catalog is already loaded as state default
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  const pollScanStatus = async (scanId: string) => {
    if (!isMountedRef.current) return;

    try {
      const res = await fetch(buildApiUrl(`/api/scans/${scanId}`));
      if (!res.ok) throw new Error(`Failed to fetch scan status (${res.status})`);
      const data: Scan = await res.json();

      if (isMountedRef.current) {
        setActiveScan(data);

        if (data.status === 'completed' || data.status === 'cancelled' || data.status === 'failed') {
          setIsScanning(false);
          setIsCancelling(false);
        } else {
          scanPollTimeoutRef.current = setTimeout(() => pollScanStatus(scanId), 1200);
        }
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setIsScanning(false);
        setIsCancelling(false);
        setErrorMsg(`Scan status query failed: ${err?.message || err}`);
      }
    }
  };

  const handleCancelScan = async () => {
    if (!activeScan || isCancelling) return;
    setIsCancelling(true);
    try {
      const res = await fetch(buildApiUrl(`/api/scans/${activeScan.scan_id}/cancel`), {
        method: 'POST',
      });
      if (res.ok) {
        const cancelledScan: Scan = await res.json();
        if (isMountedRef.current) {
          setActiveScan(cancelledScan);
          setIsScanning(false);
          setIsCancelling(false);
        }
      }
    } catch (err) {
      console.error('Failed to cancel scan:', err);
      setIsCancelling(false);
    }
  };

  const handleStartFlow = async (url: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(buildApiUrl('/api/flows/guided'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_url: url, include_ai: false }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Flow capture failed (${res.status})`);
      }
      const flowRes: GuidedFlowResult = await res.json();
      // Render flow findings
      if (isMountedRef.current) {
        setReport({
          url: flowRes.root_url,
          timestamp: new Date().toISOString(),
          disclaimer: 'Guided safe checkout flow findings for human review, not legal conclusions.',
          summary_by_category: {
            consent: flowRes.findings.filter((f) => f.category === 'consent').length,
            hidden_charges: flowRes.findings.filter((f) => f.category === 'hidden_charges').length,
            cancellation: flowRes.findings.filter((f) => f.category === 'cancellation').length,
          },
          findings: flowRes.findings,
          rule_findings: flowRes.findings,
          ai_findings: [],
          rule_findings_count: flowRes.findings.length,
          ai_findings_count: 0,
          ai_status: 'skipped_no_key',
          ai_status_message: flowRes.flow_stopped_reason || 'Flow capture concluded',
          page_title: `Guided Checkout Flow (${flowRes.steps.filter((s) => s.status === 'reached').length} steps reached)`,
          is_flow: true,
          step_count: flowRes.steps.length,
        });
        setActiveScan(null);
        setShowInputForm(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setErrorMsg(`Guided flow error: ${err.message || err}`);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleAnalyze = async (payload: {
    url?: string;
    html_content?: string;
    corpus_id?: string;
    include_ai?: boolean;
    scan_url?: string;
  }) => {
    if (isLoading || isScanning) return;

    analyzeAbortRef.current?.abort();
    const controller = new AbortController();
    analyzeAbortRef.current = controller;

    setErrorMsg(null);
    setSelectedFindingIndex(null);

    // If multi-page site scan requested
    if (payload.scan_url) {
      setReport(null);
      setActiveScan(null);
      setIsScanning(true);
      setShowInputForm(false);

      try {
        const res = await fetch(buildApiUrl('/api/scans'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            root_url: payload.scan_url,
            include_ai: payload.include_ai,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Scan initiation failed (${res.status})`);
        }

        const scanData: Scan = await res.json();
        if (isMountedRef.current) {
          setActiveScan(scanData);
          pollScanStatus(scanData.scan_id);
        }
      } catch (scanErr: any) {
        if (scanErr.name === 'AbortError') return;
        if (isMountedRef.current) {
          setIsScanning(false);
          setErrorMsg(scanErr.message || 'Failed to start multi-page site scan');
        }
      }
      return;
    }

    // Single page or sample analysis
    setIsLoading(true);
    setActiveScan(null);
    setReport(null);

    try {
      // Check for precomputed ground-truth report if a sample fixture was chosen
      const precomputed = payload.corpus_id
        ? (sampleReports as Record<string, any>)[payload.corpus_id]
        : null;

      let data: AnalysisReport | null = null;

      try {
        const res = await fetch(buildApiUrl('/api/analyze'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          // If API returns 404 or fails on a sample fixture, use precomputed ground-truth
          if (precomputed) {
            data = precomputed as AnalysisReport;
          } else {
            let detail = '';
            if (res.status === 404) {
              detail =
                'Backend inspection server not found (HTTP 404). Live URL analysis requires the ClearClick Python backend (FastAPI + Playwright). If running locally, start the service with: "python -m uvicorn backend.app.main:app --port 8000". If visiting on a static web host, configure a live backend URL via Server Settings, or explore our pre-computed Ground-Truth Sample Cases.';
            } else {
              try {
                const err = await res.json();
                if (typeof err === 'string') {
                  detail = err;
                } else if (typeof err.detail === 'string') {
                  detail = err.detail;
                } else if (Array.isArray(err.detail)) {
                  detail = err.detail
                    .map((d: any) => {
                      if (d && typeof d === 'object') {
                        const loc = Array.isArray(d.loc) ? d.loc.filter((l: any) => l !== 'body').join('.') : '';
                        return loc ? `${loc}: ${d.msg || 'Invalid value'}` : (d.msg || JSON.stringify(d));
                      }
                      return String(d);
                    })
                    .join('; ');
                } else if (err.detail && typeof err.detail === 'object') {
                  detail = err.detail.msg || err.detail.message || JSON.stringify(err.detail);
                } else if (typeof err.error === 'string') {
                  detail = err.error;
                } else if (typeof err.msg === 'string') {
                  detail = err.msg;
                } else if (err.message) {
                  detail = err.message;
                }
              } catch {
                detail = `Server error (${res.status}: ${res.statusText || 'Analysis failed'})`;
              }
            }
            throw new Error(detail.trim() || 'Analysis failed');
          }
        } else {
          data = await res.json();
        }
      } catch (fetchErr: any) {
        if (precomputed) {
          data = precomputed as AnalysisReport;
        } else {
          throw fetchErr;
        }
      }

      if (isMountedRef.current && data) {
        setReport(data);
        setShowInputForm(false); // Collapse form so user sees report immediately
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }

      const errMsg = err?.message || (typeof err === 'string' ? err : '');
      const isConnectionError =
        err?.name === 'TypeError' ||
        errMsg === 'Failed to fetch' ||
        (typeof errMsg === 'string' && (
          errMsg.includes('NetworkError') ||
          errMsg.includes('Load failed') ||
          errMsg.includes('fetch failed')
        ));

      const msg = isConnectionError
        ? 'Unable to connect to the backend inspection server. If running locally, verify: "python -m uvicorn backend.app.main:app --port 8000". If on a web host, configure your backend URL in Server Settings.'
        : (errMsg || 'An unexpected error occurred during inspection');
      if (isMountedRef.current) {
        setErrorMsg(msg);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Error Notification */}
      {errorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 p-4 bg-red-tint dark:bg-[#B91C1C]/20 border border-red-pen/40 rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-red-pen dark:text-red-200"
        >
          <div className="flex items-start gap-3 min-w-0">
            <AlertCircle className="w-5 h-5 text-red-pen shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <span className="font-medium break-words block leading-relaxed">{errorMsg}</span>
              <button
                type="button"
                onClick={() => setIsServerModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                <Server className="w-3.5 h-3.5" />
                Configure Backend Server URL
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="p-1 rounded-sm hover:bg-red-pen/10 dark:hover:bg-[#B91C1C]/30 text-red-pen dark:text-red-200 transition-colors shrink-0 self-end sm:self-center"
            aria-label="Dismiss error notification"
            title="Dismiss error"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* When NO report or scan is active: Standalone Page Header */}
      {!report && !activeScan && !isScanning && (
        <div className="mb-8">
          <p className="font-mono text-xs text-ink-muted dark:text-[#94A3B8] uppercase tracking-wider mb-1">
            Inspection Engine · Dark Pattern Audit
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-ink dark:text-[#E2E8F0] tracking-tight mb-2 outline-none focus:outline-none focus-visible:outline-none">
            Check a page or scan a site for design that may mislead you
          </h1>
          <p className="text-ink-muted dark:text-[#94A3B8] text-base leading-relaxed max-w-3xl">
            Audit single URLs, scan priority transactional pages of a domain, drop screenshots, or inspect ground-truth fixtures. ClearClick flags hidden charges, cancellation hurdles, and one-sided consent choices.
          </p>
        </div>
      )}

      {/* Input Form (visible by default when no report/scan, collapsible when report/scan active) */}
      {(!report && !activeScan && !isScanning) || showInputForm ? (
        <div className={report || activeScan ? 'mb-8 pb-8 border-b border-border-hairline dark:border-[#26324A]' : ''}>
          <InputForm
            onAnalyze={handleAnalyze}
            isLoading={isLoading || isScanning}
            corpusList={corpusList}
          />
        </div>
      ) : null}

      {/* Live Site Scan Progress Screen */}
      {isScanning && activeScan && (
        <div className="mb-8">
          <SiteScanProgress
            scan={activeScan}
            onCancel={handleCancelScan}
            isCancelling={isCancelling}
          />
        </div>
      )}

      {/* Finished or Partial Site Scan Report Screen */}
      {!isScanning && activeScan && (
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setActiveScan(null);
                setReport(null);
                setShowInputForm(true);
              }}
              className="text-xs font-mono underline hover:text-red-pen transition-colors text-ink dark:text-[#2DD4BF] cursor-pointer"
            >
              ← Scan another site or check a page
            </button>
          </div>
          <ScanReportView
            scan={activeScan}
            onOpenUpload={() => {
              setActiveScan(null);
              setReport(null);
              setShowInputForm(true);
            }}
            onStartFlow={handleStartFlow}
          />
        </div>
      )}

      {/* Results Workspace: Proofreader UI Layout */}
      {report && (
        <div className="flex flex-col w-full">
          {/* Header Strip */}
          <section className="border-b border-border-hairline dark:border-[#26324A] pb-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <p className="font-mono text-xs text-ink-muted dark:text-[#94A3B8] uppercase tracking-wider">
                    Audit Record · {report.timestamp ? new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Checked just now'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowInputForm((prev) => !prev)}
                    className="text-xs font-mono underline hover:text-red-pen transition-colors text-ink dark:text-[#2DD4BF]"
                  >
                    {showInputForm ? 'Hide input form' : 'Check another page'}
                  </button>
                </div>
                <h1 className="font-serif text-3xl font-semibold text-ink dark:text-[#E2E8F0] outline-none focus:outline-none focus-visible:outline-none">
                  {report.page_status && report.page_status !== 'ok'
                    ? "We couldn't access this page automatically"
                    : report.findings.length === 0
                    ? 'No misleading patterns detected'
                    : `${report.findings.length} thing${report.findings.length === 1 ? '' : 's'} worth a closer look`}
                </h1>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm text-ink-muted dark:text-[#94A3B8]">
                  {report.page_status && report.page_status !== 'ok'
                    ? 'Automated fetch blocked or restricted by host'
                    : 'Automated warnings for you to judge, not legal conclusions.'}
                </p>
                <p className="font-mono text-xs text-ink-muted dark:text-[#94A3B8] mt-0.5">
                  Status:{' '}
                  <span className="text-ink dark:text-[#E2E8F0] font-medium">
                    {report.page_status && report.page_status !== 'ok'
                      ? `Access status: ${report.page_status}`
                      : `AI analysis: ${report.ai_status === 'completed' || report.ai_status === 'ran' ? 'on' : report.ai_status === 'failed' || report.ai_status === 'unavailable' ? 'unavailable' : 'off'}`}
                  </span>{' '}
                  · Engine:{' '}
                  <span className="text-ink dark:text-[#E2E8F0] font-medium">
                    {report.page_status && report.page_status !== 'ok' ? 'Block Guard' : report.ai_status === 'completed' || report.ai_status === 'ran' ? 'Rules + Vision LLM' : 'Deterministic Rules'}
                  </span>
                </p>
              </div>
            </div>
          </section>

          {/* Access Blocked Banner */}
          {report.page_status && report.page_status !== 'ok' ? (
            <div className="p-8 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-sm mb-8">
              <div className="flex items-start gap-4">
                <ShieldAlert className="w-8 h-8 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-3">
                  <div>
                    <h2 className="font-serif text-2xl font-semibold text-ink dark:text-[#E2E8F0] mb-1">
                      We couldn't access this page automatically
                    </h2>
                    <p className="text-sm text-ink-muted dark:text-[#94A3B8] leading-relaxed">
                      {report.status_reason || 'This website returned an anti-bot challenge or requires interactive authentication.'}
                    </p>
                  </div>
                  <p className="text-xs text-ink-muted dark:text-[#94A3B8] leading-relaxed">
                    ClearClick AI strictly adheres to automated politeness: we do not bypass bot walls, spoof fingerprints, or solve CAPTCHAs. Because the page could not be accessed, it has not been scored or certified as clean.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInputForm(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-ink dark:bg-[#2DD4BF] text-paper dark:text-[#0F172A] text-xs font-mono font-medium rounded-sm hover:opacity-90 transition-opacity"
                    >
                      <UploadCloud className="w-4 h-4" />
                      Upload Screenshot Instead
                    </button>
                    <Link
                      to="/methodology#limits"
                      className="inline-flex items-center gap-1 text-xs font-mono underline text-ink-muted dark:text-[#94A3B8] hover:text-ink dark:hover:text-[#E2E8F0]"
                    >
                      Read about automated access limits
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
            {/* LEFT: Screenshot Canvas with Proofreader's Markup (6 cols) */}
            <section className="lg:col-span-6 flex flex-col">
              <ScreenshotViewer
                screenshotBase64={report.screenshot_base64}
                findings={report.findings}
                selectedFindingIndex={selectedFindingIndex}
                onSelectFinding={(idx) => setSelectedFindingIndex(idx)}
                url={report.url}
                isFlow={report.is_flow}
              />
            </section>

            {/* RIGHT: Proofreader Margin Notes (4 cols) */}
            <section className="lg:col-span-4 flex flex-col">
              <FindingsPanel
                findings={report.findings}
                summaryByCategory={report.summary_by_category}
                selectedFindingIndex={selectedFindingIndex}
                onSelectFinding={(idx) => setSelectedFindingIndex(idx)}
                disclaimer={report.disclaimer}
                aiStatus={report.ai_status}
                aiStatusMessage={report.ai_status_message}
                ruleFindingsCount={report.rule_findings_count}
                aiFindingsCount={report.ai_findings_count}
              />
            </section>
          </div>
        )}
        </div>
      )}

      {/* Backend Server Settings Modal */}
      <ServerSettingsModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
      />
    </div>
  );
};
