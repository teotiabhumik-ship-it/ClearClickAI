import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AnalysisReport, CorpusItem } from '../types';
import { InputForm } from '../components/InputForm';
import { ScreenshotViewer } from '../components/ScreenshotViewer';
import { FindingsPanel } from '../components/FindingsPanel';
import { AlertCircle, HelpCircle } from 'lucide-react';

export const AnalysePage: React.FC = () => {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [corpusList, setCorpusList] = useState<CorpusItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFindingIndex, setSelectedFindingIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load available corpus catalog on startup
  useEffect(() => {
    fetch('/api/corpus')
      .then((res) => res.json())
      .then((data: CorpusItem[]) => {
        setCorpusList(data);
        // Automatically run initial analysis on first dark pattern fixture
        if (data.length > 0) {
          handleAnalyze({ corpus_id: 'consent_asymmetric_buttons', include_ai: true });
        }
      })
      .catch((err) => console.error('Failed to load corpus catalog:', err));
  }, []);

  const handleAnalyze = async (payload: {
    url?: string;
    html_content?: string;
    corpus_id?: string;
    include_ai?: boolean;
  }) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSelectedFindingIndex(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Analysis failed');
      }

      const data: AnalysisReport = await res.json();
      setReport(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during inspection');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Main Heading & Subtitle */}
      <div className="mb-6">
        <h1 className="font-bold text-2xl sm:text-3xl text-on-surface dark:text-[#E2E8F0] tracking-tight mb-2 outline-none">
          Check a page for design that may mislead you
        </h1>
        <p className="text-on-surface-variant dark:text-[#94A3B8] text-sm sm:text-base leading-relaxed max-w-3xl">
          Paste a link, drop a screenshot, or choose a demo fixture. ClearClick looks for hidden charges, cancellation hurdles, and one-sided consent choices.
        </p>
      </div>

      {/* Error Notification */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-error-container/60 dark:bg-[#B91C1C]/20 border border-error/30 dark:border-[#B91C1C]/40 rounded-xl flex items-center gap-3 text-sm text-on-error-container dark:text-red-200">
          <AlertCircle className="w-5 h-5 text-error shrink-0" aria-hidden="true" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Interactive Input Card & Focus Cards */}
      <InputForm
        onAnalyze={handleAnalyze}
        isLoading={isLoading}
        corpusList={corpusList}
      />

      {/* Results Workspace */}
      {report && (
        <div className="mt-8 pt-6 border-t border-outline-variant/30 dark:border-[#26324A]">
          {/* Report Header with Cross Links */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-on-surface dark:text-[#E2E8F0]">Inspection Results</h2>
              <span className="text-xs font-mono text-on-surface-variant dark:text-[#94A3B8] bg-surface-container dark:bg-[#111A2E] px-2.5 py-0.5 rounded font-medium truncate max-w-xs sm:max-w-md">
                {report.url || 'Target Page'}
              </span>
            </div>

            {/* Cross Links to Methodology */}
            <div className="flex items-center gap-3 text-xs">
              <Link
                to="/methodology#how-it-checks"
                className="inline-flex items-center gap-1 text-primary dark:text-[#2DD4BF] hover:underline font-medium"
              >
                <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>How it checks</span>
              </Link>
              <span className="text-outline-variant dark:text-[#26324A]" aria-hidden="true">•</span>
              <Link
                to="/methodology#accuracy"
                className="text-primary dark:text-[#2DD4BF] hover:underline font-medium"
              >
                Accuracy benchmark
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Evidence Viewport Canvas (7 cols) */}
            <div className="lg:col-span-7 flex flex-col">
              <ScreenshotViewer
                screenshotBase64={report.screenshot_base64}
                findings={report.findings}
                selectedFindingIndex={selectedFindingIndex}
                onSelectFinding={(idx) => setSelectedFindingIndex(idx)}
              />
            </div>

            {/* Right: Categorized Findings & Recommendations Panel (5 cols) */}
            <div className="lg:col-span-5 flex flex-col">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
