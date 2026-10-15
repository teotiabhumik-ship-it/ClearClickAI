import React, { useState, useEffect } from 'react';
import { ShieldCheck, Eye, Layers, Sparkles, BookOpen, AlertCircle } from 'lucide-react';
import { AnalysisReport, CorpusItem } from './types';
import { InputForm } from './components/InputForm';
import { ScreenshotViewer } from './components/ScreenshotViewer';
import { FindingsPanel } from './components/FindingsPanel';
import { EvaluationModal } from './components/EvaluationModal';

export const App: React.FC = () => {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [corpusList, setCorpusList] = useState<CorpusItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFindingIndex, setSelectedFindingIndex] = useState<number | null>(null);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load available corpus on startup
  useEffect(() => {
    fetch('/api/corpus')
      .then((res) => res.json())
      .then((data: CorpusItem[]) => {
        setCorpusList(data);
        // Automatically run initial analysis on first dark pattern fixture
        if (data.length > 0) {
          handleAnalyze({ corpus_id: 'consent_asymmetric_buttons' });
        }
      })
      .catch((err) => console.error('Failed to load corpus catalog:', err));
  }, []);

  const handleAnalyze = async (payload: { url?: string; html_content?: string; corpus_id?: string }) => {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 text-white p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">ClearClick AI</span>
                <span className="text-[10px] font-mono uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-semibold">
                  Prototype
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Evidence-Based Dark Pattern Auditor & Fair Design Advisor</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-800/60 border border-slate-700/60 rounded-lg text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Hybrid Rules + Anti-Hallucination AI</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-6 flex-1 flex flex-col gap-6 w-full">
        {/* Error Notification */}
        {errorMsg && (
          <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-xl flex items-center gap-3 text-sm text-rose-200">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Input & Preset Form */}
        <InputForm
          onAnalyze={handleAnalyze}
          onOpenBenchmark={() => setIsBenchmarkOpen(true)}
          isLoading={isLoading}
          corpusList={corpusList}
        />

        {/* Results Workspace */}
        {report && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
            {/* Left: Interactive Visualizer Canvas (7 cols) */}
            <div className="lg:col-span-7 flex flex-col">
              <ScreenshotViewer
                screenshotBase64={report.screenshot_base64}
                findings={report.findings}
                selectedFindingIndex={selectedFindingIndex}
                onSelectFinding={(idx) => setSelectedFindingIndex(idx)}
              />
            </div>

            {/* Right: Categorized Findings & Fair Alternatives Panel (5 cols) */}
            <div className="lg:col-span-5 flex flex-col">
              <FindingsPanel
                findings={report.findings}
                summaryByCategory={report.summary_by_category}
                selectedFindingIndex={selectedFindingIndex}
                onSelectFinding={(idx) => setSelectedFindingIndex(idx)}
                disclaimer={report.disclaimer}
              />
            </div>
          </div>
        )}
      </main>

      {/* Evaluation & Benchmarking Modal */}
      <EvaluationModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
        ClearClick AI Prototype • Evidence, not accusations • Rules where possible, AI where needed
      </footer>
    </div>
  );
};
