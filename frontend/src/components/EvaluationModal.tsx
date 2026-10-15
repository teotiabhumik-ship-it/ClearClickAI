import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, CheckCircle2, XCircle, RefreshCw, BarChart2 } from 'lucide-react';
import { BenchmarkResult } from '../types';

interface EvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EvaluationModal: React.FC<EvaluationModalProps> = ({ isOpen, onClose }) => {
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchBenchmark = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/benchmark');
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
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Evaluation & Benchmarking Suite</h3>
              <p className="text-xs text-slate-400">Ground-truth validation across all positive and negative corpus fixtures</p>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium">Executing full corpus evaluation pipeline...</p>
            </div>
          ) : benchmarkData ? (
            <>
              {/* Scorecard Hero */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-center">
                  <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Overall Precision</div>
                  <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                    {Math.round(benchmarkData.overall.precision * 100)}%
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">TP / (TP + FP)</div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-center">
                  <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Overall Recall</div>
                  <div className="text-3xl font-extrabold text-blue-400 mt-1">
                    {Math.round(benchmarkData.overall.recall * 100)}%
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">TP / (TP + FN)</div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-center">
                  <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">F1 Score</div>
                  <div className="text-3xl font-extrabold text-purple-400 mt-1">
                    {benchmarkData.overall.f1.toFixed(3)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Harmonic mean</div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-center">
                  <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Corpus Test Cases</div>
                  <div className="text-3xl font-extrabold text-white mt-1">
                    {benchmarkData.overall.total}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Positive & Clean controls</div>
                </div>
              </div>

              {/* Per-Category Score Breakdown */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-semibold uppercase text-slate-300 tracking-wider mb-3">
                  Category Breakdown Performance
                </h4>
                <div className="grid grid-cols-3 gap-3">
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
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual Case Log */}
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-300 tracking-wider mb-3">
                  Corpus Fixture Verification Matrix
                </h4>
                <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80 text-xs font-mono">
                  {benchmarkData.details.map((detail) => (
                    <div key={detail.id} className="p-3 flex items-center justify-between bg-slate-950/40 hover:bg-slate-950/80">
                      <div className="flex items-center gap-2">
                        {detail.status === 'PASS' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-200">{detail.id}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-400 text-[11px]">
                        <div>Expected: <span className="text-amber-400 font-sans">[{detail.expected.join(', ')}]</span></div>
                        <div>Detected: <span className="text-blue-400 font-sans">[{detail.detected.join(', ')}]</span></div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          detail.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {detail.status}
                        </span>
                      </div>
                    </div>
                  ))}
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
