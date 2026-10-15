import React, { useState } from 'react';
import { Globe, FileCode, Play, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { CorpusItem } from '../types';

interface InputFormProps {
  onAnalyze: (payload: { url?: string; html_content?: string; corpus_id?: string }) => void;
  onOpenBenchmark: () => void;
  isLoading: boolean;
  corpusList: CorpusItem[];
}

export const InputForm: React.FC<InputFormProps> = ({
  onAnalyze,
  onOpenBenchmark,
  isLoading,
  corpusList,
}) => {
  const [activeTab, setActiveTab] = useState<'corpus' | 'url' | 'html'>('corpus');
  const [url, setUrl] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [selectedCorpusId, setSelectedCorpusId] = useState<string>('consent_asymmetric_buttons');

  const positiveCorpus = corpusList.filter(c => c.patterns.length > 0);
  const cleanCorpus = corpusList.filter(c => c.patterns.length === 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'corpus') {
      onAnalyze({ corpus_id: selectedCorpusId });
    } else if (activeTab === 'url') {
      if (!url.trim()) return;
      onAnalyze({ url: url.trim() });
    } else {
      if (!htmlContent.trim()) return;
      onAnalyze({ html_content: htmlContent.trim() });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600/20 text-blue-400 p-2 rounded-lg border border-blue-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Target Inspector</h2>
            <p className="text-xs text-slate-400">Choose a ground-truth corpus fixture or enter custom URL/HTML</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenBenchmark}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/50 rounded-lg transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Benchmark Suite (Evaluation)</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 bg-slate-950 p-1 rounded-lg border border-slate-800 max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('corpus')}
          className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
            activeTab === 'corpus'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Corpus Fixtures ({corpusList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
            activeTab === 'url'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Live URL
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('html')}
          className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
            activeTab === 'html'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Paste HTML
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {activeTab === 'corpus' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Select Pre-Configured Test Case
              </label>
              <select
                value={selectedCorpusId}
                onChange={(e) => setSelectedCorpusId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
              >
                <optgroup label="⚠️ Positive Examples (Dark Patterns)">
                  {positiveCorpus.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.category.toUpperCase()}] {item.id} — {item.notes}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="✅ Negative Examples (Clean Fair Controls)">
                  {cleanCorpus.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.category.toUpperCase()}] {item.id} — {item.notes}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Quick tags display for selected corpus */}
            {(() => {
              const current = corpusList.find((c) => c.id === selectedCorpusId);
              if (!current) return null;
              return (
                <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Category:</span>
                    <span className="text-blue-400 font-medium capitalize">{current.category.replace('_', ' ')}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">Ground Truth:</span>
                    {current.patterns.length > 0 ? (
                      <span className="text-amber-400 flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" /> {current.patterns.join(', ')}
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Clean Control (0 patterns)
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 italic">"{current.notes}"</div>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'url' && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Website URL</label>
            <div className="relative">
              <Globe className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="https://example.com/checkout or file:///..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>
        )}

        {activeTab === 'html' && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Paste Raw HTML Document</label>
            <textarea
              rows={4}
              placeholder="<html><body>...</body></html>"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors shadow-lg shadow-blue-600/20 text-sm"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Analyzing DOM, Styles & Vision with Playwright...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Run ClearClick Inspection</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
