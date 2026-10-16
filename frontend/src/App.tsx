import React, { useState, useEffect } from 'react';
import { AnalysisReport, CorpusItem } from './types';
import { InputForm } from './components/InputForm';
import { ScreenshotViewer } from './components/ScreenshotViewer';
import { FindingsPanel } from './components/FindingsPanel';
import { EvaluationModal } from './components/EvaluationModal';
import { AboutModal } from './components/AboutModal';

export const App: React.FC = () => {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [corpusList, setCorpusList] = useState<CorpusItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFindingIndex, setSelectedFindingIndex] = useState<number | null>(null);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<'analyse' | 'methodology' | 'about'>('analyse');

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
    <div className="min-h-screen bg-surface font-sans text-on-surface flex flex-col">
      {/* Fixed Top Header */}
      <header className="fixed top-0 inset-x-0 z-40 bg-surface/80 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-outline-variant/20">
        <div className="h-14 max-w-7xl mx-auto px-space-md flex items-center justify-between">
          <div
            className="flex items-center gap-space-sm cursor-pointer select-none"
            onClick={() => {
              setActiveNav('analyse');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <span className="material-symbols-outlined text-primary text-[24px]">verified</span>
            <span className="font-headline-sm font-bold text-on-surface text-lg tracking-tight">ClearClick</span>
            <span className="text-[10px] font-mono uppercase bg-primary-fixed text-primary px-2 py-0.5 rounded-full font-semibold ml-1">
              AI Auditor
            </span>
          </div>

          <div className="flex items-center gap-space-sm">
            <button
              onClick={() => setIsBenchmarkOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-container-lowest text-on-surface border border-outline-variant/30 hover:bg-surface-container transition-all shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">bar_chart</span>
              <span>Benchmark Suite</span>
            </button>
            <button
              onClick={() => setIsAboutOpen(true)}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary hover:opacity-90 transition-opacity"
              title="About ClearClick"
            >
              <span className="material-symbols-outlined text-[18px]">info</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-col relative w-full max-w-7xl mx-auto px-space-md pt-20 pb-28 bg-surface flex-1">
        {/* Main Heading & Subtitle */}
        <div className="mb-space-lg">
          <h1 className="font-headline-lg text-on-surface mb-space-xs font-bold text-2xl sm:text-3xl tracking-tight">
            Check a page for design that may mislead you.
          </h1>
          <p className="font-body-md text-on-surface-variant text-sm sm:text-base">
            Paste a link, drop a screenshot, or explore pre-analyzed demo corpus items to uncover deceptive patterns instantly.
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-space-md p-4 bg-error-container/60 border border-error/30 rounded-xl flex items-center gap-3 text-sm text-on-error-container">
            <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Interactive Input Card & Common Patterns */}
        <InputForm
          onAnalyze={handleAnalyze}
          onOpenBenchmark={() => setIsBenchmarkOpen(true)}
          isLoading={isLoading}
          corpusList={corpusList}
        />

        {/* Results Workspace (Rendered when report is available) */}
        {report && (
          <div className="mt-space-xl pt-space-lg border-t border-outline-variant/30">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-space-md">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-primary text-[22px]">analytics</span>
                <h2 className="text-lg font-bold text-on-surface">Inspection Results</h2>
                <span className="text-xs font-mono text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded font-medium truncate max-w-sm">
                  {report.url || 'Target Page'}
                </span>
              </div>
              <span className="text-xs text-on-surface-variant font-medium">
                {report.findings.length} Potential Pattern{report.findings.length !== 1 ? 's' : ''} Identified
              </span>
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
      </main>

      {/* Evaluation & Benchmarking Modal */}
      <EvaluationModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />

      {/* About ClearClick Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-1px_8px_rgba(0,0,0,0.04)] border-t border-outline-variant/20">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-space-md">
          <button
            onClick={() => {
              setActiveNav('analyse');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center gap-0.5 w-20 h-12 rounded-xl transition-all ${
              activeNav === 'analyse'
                ? 'bg-primary-container text-on-primary-container font-semibold shadow-2xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">analytics</span>
            <span className="text-[11px] font-medium">Analyse</span>
          </button>

          <button
            onClick={() => {
              setIsBenchmarkOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-0.5 w-20 h-12 rounded-xl text-on-surface-variant hover:text-on-surface transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">menu_book</span>
            <span className="text-[11px] font-medium">Methodology</span>
          </button>

          <button
            onClick={() => {
              setIsAboutOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-0.5 w-20 h-12 rounded-xl text-on-surface-variant hover:text-on-surface transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">info</span>
            <span className="text-[11px] font-medium">About</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
