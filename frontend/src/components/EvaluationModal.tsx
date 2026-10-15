import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, CheckCircle2, XCircle, RefreshCw, BarChart2, Info, AlertTriangle, Cpu } from 'lucide-react';
import { BenchmarkResult } from '../types';

interface EvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EvaluationModal: React.FC<EvaluationModalProps> = ({ isOpen, onClose }) => {
  const [split, setSplit] = useState<'held_out' | 'dev'>('held_out');
  const [includeAi, setIncludeAi] = useState<boolean>(false);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchBenchmark = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/benchmark?split=${split}&include_ai=${includeAi}`);
      if (res.ok) {
        const data = await res.json();
        setBenchmarkData(data);
      }
    } catch (err) {
      console.error('Failed to load benchmark:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBenchmark();
    }
  }, [isOpen, split, includeAi]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Honest Evaluation & Benchmarking Suite</h3>
                <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded">
                  Dual-Split Validation
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ground-truth evaluation across positive deceptive cases and clean control pages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchBenchmark}
              disabled={isLoading}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              title="Re-run evaluation"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Controls: Split Selector & Mode */}
        <div className="px-6 py-3 bg-slate-950/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* Split Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evaluation Set:</span>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-900 border border-slate-800">
              <button
                onClick={() => setSplit('held_out')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  split === 'held_out'
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Held-Out Test Set (16 Cases)
              </button>
              <button
                onClick={() => setSplit('dev')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  split === 'dev'
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Development Set (25 Cases)
              </button>
            </div>
          </div>

          {/* AI vs Rule Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Detector Mode:</span>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-900 border border-slate-800">
              <button
                onClick={() => setIncludeAi(false)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  !includeAi
                    ? 'bg-slate-800 text-cyan-300 font-semibold border border-cyan-800/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Rules Only
              </button>
              <button
                onClick={() => setIncludeAi(true)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  includeAi
                    ? 'bg-purple-950/80 text-purple-300 font-semibold border border-purple-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Rules + AI
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Split context banner */}
          <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              {split === 'held_out' ? (
                <>
                  <strong className="text-white font-semibold">Held-Out Test Set: </strong>
                  Strictly immutable evaluation split (8 dark patterns, 8 tricky clean controls). Detectors were never tuned against this split.
                </>
              ) : (
                <>
                  <strong className="text-white font-semibold">Development Tuning Set: </strong>
                  25 calibration fixtures (15 positive patterns, 10 clean controls) used during Ralph detector iteration loops.
                </>
              )}
              {includeAi && (
                <div className="mt-1 text-purple-300 font-mono text-[11px]">
                  {benchmarkData?.ai_status_message || 'AI layer evaluation enabled'}
                </div>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium">Executing benchmark across {split === 'held_out' ? 'held-out test' : 'dev'} fixtures...</p>
            </div>
          ) : benchmarkData ? (
            <>
              {/* Scorecard Hero */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-center">
                  <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Precision</div>
                  <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                    {Math.round(benchmarkData.overall.precision * 100)}%
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    TP: {benchmarkData.overall.tp} | FP: {benchmarkData.overall.fp}
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-center">
                  <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Recall</div>
                  <div className="text-3xl font-extrabold text-blue-400 mt-1">
                    {Math.round(benchmarkData.overall.recall * 100)}%
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    TP: {benchmarkData.overall.tp} | FN: {benchmarkData.overall.fn}
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-center">
                  <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">F1 Score</div>
                  <div className="text-3xl font-extrabold text-purple-400 mt-1">
                    {benchmarkData.overall.f1.toFixed(3)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Harmonic mean</div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-center">
                  <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Fixtures Tested</div>
                  <div className="text-3xl font-extrabold text-white mt-1">
                    {benchmarkData.overall.total}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {split === 'held_out' ? '16 immutable test cases' : '25 dev cases'}
                  </div>
                </div>
              </div>

              {/* Per-Category Score Breakdown */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-semibold uppercase text-slate-300 tracking-wider mb-3">
                  Per-Category Breakdown ({split.toUpperCase()} Split)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.entries(benchmarkData.categories).map(([category, m]) => (
                    <div key={category} className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg">
                      <div className="text-xs font-bold text-white capitalize mb-1">
                        {category.replace('_', ' ')}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                        <span>Precision:</span>
                        <span className="font-mono text-emerald-400 font-semibold">{Math.round(m.precision * 100)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                        <span>Recall:</span>
                        <span className="font-mono text-blue-400 font-semibold">{Math.round(m.recall * 100)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                        <span>F1 Score:</span>
                        <span className="font-mono text-purple-400 font-semibold">{m.f1.toFixed(3)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-800">
                        TP: {m.tp} | FP: {m.fp} | FN: {m.fn}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual Case Log */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase text-slate-300 tracking-wider">
                    Fixture Verification Matrix ({benchmarkData.details.length} Cases)
                  </h4>
                  <span className="text-xs font-mono text-slate-500">
                    Failures: {benchmarkData.details.filter(d => d.status === 'FAIL').length}
                  </span>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80 text-xs font-mono">
                  {benchmarkData.details.map((detail) => {
                    const isFail = detail.status === 'FAIL';
                    return (
                      <div
                        key={detail.id}
                        className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                          isFail ? 'bg-rose-950/20 hover:bg-rose-950/30' : 'bg-slate-950/40 hover:bg-slate-950/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isFail ? (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                          <span className={`font-semibold ${isFail ? 'text-rose-200' : 'text-slate-200'}`}>
                            {detail.id}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-slate-400 text-[11px]">
                          <div>
                            Expected: <span className="text-amber-400 font-sans">[{detail.expected.join(', ')}]</span>
                          </div>
                          <div>
                            Detected: <span className="text-blue-400 font-sans">[{detail.detected.join(', ')}]</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isFail ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-emerald-500/10 text-emerald-400'
                            }`}
                          >
                            {detail.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-slate-500 py-10">No evaluation data loaded</p>
          )}
        </div>
      </div>
    </div>
  );
};
