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
import { SamplePagesCarousel } from '../components/SamplePagesCarousel';
import { AnalysisLoadingSkeleton, SiteScanStartingSkeleton } from '../components/SkeletonLoader';

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

  // Set document title and clean up any pending analysis request or polling on unmount
  useEffect(() => {
    document.title = 'ClearClick AI — Evidence-Based Dark Pattern Auditor';
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
          if (scanData.status === 'completed' || scanData.status === 'cancelled' || scanData.status === 'failed') {
            setIsScanning(false);
          } else {
            pollScanStatus(scanData.scan_id);
          }
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
          className="mb-6 p-4 bg-red-tint border border-red-pen/40 rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-red-pen"
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
            className="p-1 rounded-sm hover:bg-red-pen/10:bg-[#B91C1C]/30 text-red-pen transition-colors shrink-0 self-end sm:self-center"
            aria-label="Dismiss error notification"
            title="Dismiss error"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* When NO report or scan is active: Standalone Page Header */}
      {!report && !activeScan && !isScanning && !isLoading && (
        <div className="mb-6">
          {/* Editorial Header Section */}
          <div className="max-w-5xl mx-auto px-4 pt-4 pb-6 text-center relative z-10">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-semibold text-ink tracking-tight max-w-3xl mx-auto">
              Inspect web pages for misleading interface patterns.
            </h1>
          </div>

          {/* Glassmorphic Carousel of Sample Pages */}
          <SamplePagesCarousel
            samples={corpusList}
            onSelectSample={(corpusId) => handleAnalyze({ corpus_id: corpusId, include_ai: false })}
            isLoading={isLoading || isScanning}
          />
        </div>
      )}

      {/* Input Form (visible by default when no report/scan, collapsible when report/scan active) */}
      {(!report && !activeScan && !isScanning) || showInputForm ? (
        <div className={report || activeScan ? 'mb-8 pb-8 border-b border-border-hairline' : 'mb-8'}>
          <InputForm
            onAnalyze={handleAnalyze}
            isLoading={isLoading || isScanning}
            corpusList={corpusList}
          />
        </div>
      ) : null}

      {/* Initial single-page/sample analysis loading state */}
      {isLoading && !report && !activeScan && !isScanning && <AnalysisLoadingSkeleton />}

      {/* Brief transition while the asynchronous site scan is being created */}
      {isScanning && !activeScan && <SiteScanStartingSkeleton />}

      {/* Editorial Diagnostics Brief (visible when no report or scan active) */}
      {!report && !activeScan && !isScanning && !isLoading && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 mb-12 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              to="/methodology#cancellation"
              className="bg-white rounded-xl p-6 flex flex-col justify-between border border-outline-variant/60 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-amber-500 transition-all group cursor-pointer"
            >
              <div className="space-y-2">
                <span className="font-mono text-xs uppercase tracking-widest text-amber-700 font-semibold">Heuristic 01</span>
                <h3 className="font-serif text-xl text-ink font-medium group-hover:text-amber-600 transition-colors">Asymmetric Friction</h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Detects high cognitive loads placed on rejection or cancellation flows compared to one-click acceptance pathways.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-outline-variant/40 flex items-center gap-2 text-ink-muted text-xs font-mono">
                <span className="text-amber-600 font-bold text-sm">⚖</span>
                <span>Contrast &amp; Weight Diagnostics</span>
              </div>
            </Link>

            <Link
              to="/methodology#hidden-charges"
              className="bg-white rounded-xl p-6 flex flex-col justify-between border border-outline-variant/60 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-rose-500 transition-all group cursor-pointer"
            >
              <div className="space-y-2">
                <span className="font-mono text-xs uppercase tracking-widest text-rose-700 font-semibold">Heuristic 02</span>
                <h3 className="font-serif text-xl text-ink font-medium group-hover:text-rose-600 transition-colors">Drip &amp; Withheld Fees</h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Cross-evaluates cart updates against landing page guarantees to flag late-injected resort fees, delivery taxes, or auto-checked gratuity.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-outline-variant/40 flex items-center gap-2 text-ink-muted text-xs font-mono">
                <span className="text-rose-600 font-bold text-sm">💳</span>
                <span>DOM Differential Tracking</span>
              </div>
            </Link>

            <Link
              to="/methodology#consent"
              className="bg-white rounded-xl p-6 flex flex-col justify-between border border-outline-variant/60 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-sky-500 transition-all group cursor-pointer"
            >
              <div className="space-y-2">
                <span className="font-mono text-xs uppercase tracking-widest text-sky-700 font-semibold">Heuristic 03</span>
                <h3 className="font-serif text-xl text-ink font-medium group-hover:text-sky-600 transition-colors">Syntactic Pre-Selection</h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Audits default state boolean toggles across checkout funnels, highlighting stealth membership additions and pre-opt-in terms.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-outline-variant/40 flex items-center gap-2 text-ink-muted text-xs font-mono">
                <span className="text-sky-600 font-bold text-sm">✓</span>
                <span>Regulatory Compliance (EU/FTC)</span>
              </div>
            </Link>
          </div>
        </section>
      )}

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
              className="text-xs font-mono underline hover:text-red-pen transition-colors text-ink cursor-pointer"
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
            onAnalyzeSinglePage={(url) => {
              setActiveScan(null);
              setShowInputForm(false);
              handleAnalyze({ url, include_ai: false });
            }}
          />
        </div>
      )}

      {/* Results Workspace: Proofreader UI Layout */}
      {report && (
        <div className="flex flex-col w-full">
          {/* Header Strip */}
          <section className="border-b border-border-hairline pb-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <p className="font-mono text-xs text-ink-muted uppercase tracking-wider">
                    Audit Record · {report.timestamp ? new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Checked just now'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowInputForm((prev) => !prev)}
                    className="text-xs font-mono underline hover:text-red-pen transition-colors text-ink"
                  >
                    {showInputForm ? 'Hide input form' : 'Check another page'}
                  </button>
                </div>
                <h1 className="font-serif text-3xl font-semibold text-ink outline-none focus:outline-none focus-visible:outline-none">
                  {report.page_status && report.page_status !== 'ok'
                    ? "We couldn't access this page automatically"
                    : report.findings.length === 0
                    ? 'No misleading patterns detected'
                    : `${report.findings.length} thing${report.findings.length === 1 ? '' : 's'} worth a closer look`}
                </h1>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm text-ink-muted">
                  {report.page_status && report.page_status !== 'ok'
                    ? 'Automated fetch blocked or restricted by host'
                    : 'Automated warnings for you to judge, not legal conclusions.'}
                </p>
                <p className="font-mono text-xs text-ink-muted mt-0.5">
                  Status:{' '}
                  <span className="text-ink font-medium">
                    {report.page_status && report.page_status !== 'ok'
                      ? `Access status: ${report.page_status}`
                      : `AI analysis: ${report.ai_status === 'completed' || report.ai_status === 'ran' ? 'on' : report.ai_status === 'failed' || report.ai_status === 'unavailable' ? 'unavailable' : 'off'}`}
                  </span>{' '}
                  · Engine:{' '}
                  <span className="text-ink font-medium">
                    {report.page_status && report.page_status !== 'ok' ? 'Block Guard' : report.ai_status === 'completed' || report.ai_status === 'ran' ? 'Rules + Vision LLM' : 'Deterministic Rules'}
                  </span>
                </p>
              </div>
            </div>
          </section>

          {/* Access Blocked Banner */}
          {report.page_status && report.page_status !== 'ok' ? (
            <div className="p-8 bg-amber-50/60 border border-amber-300 rounded-sm mb-8">
              <div className="flex items-start gap-4">
                <ShieldAlert className="w-8 h-8 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-3">
                  <div>
                    <h2 className="font-serif text-2xl font-semibold text-ink mb-1">
                      We couldn't access this page automatically
                    </h2>
                    <p className="text-sm text-ink-muted leading-relaxed">
                      {report.status_reason || 'This website returned an anti-bot challenge or requires interactive authentication.'}
                    </p>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    ClearClick AI strictly adheres to automated politeness: we do not bypass bot walls, spoof fingerprints, or solve CAPTCHAs. Because the page could not be accessed, it has not been scored or certified as clean.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInputForm(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-paper text-xs font-mono font-medium rounded-sm hover:opacity-90 transition-opacity"
                    >
                      <UploadCloud className="w-4 h-4" />
                      Upload Screenshot Instead
                    </button>
                    <Link
                      to="/methodology#limits"
                      className="inline-flex items-center gap-1 text-xs font-mono underline text-ink-muted hover:text-ink:text-[#e6e1df]"
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
