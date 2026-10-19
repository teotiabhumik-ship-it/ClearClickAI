import React, { useState, useRef, useEffect } from 'react';
import {
  Globe,
  Sparkles,
  Loader2,
  Lock,
  X,
  CheckCircle,
} from 'lucide-react';
import { CorpusItem } from '../types';

interface InputFormProps {
  onAnalyze: (payload: {
    url?: string;
    html_content?: string;
    corpus_id?: string;
    include_ai?: boolean;
    scan_url?: string;
  }) => void;
  isLoading: boolean;
  corpusList?: CorpusItem[];
}

const normalizeDroppedUrl = (raw: string): string => {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/[.,;)]+$/, '');
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned;
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
};

const extractUrlFromDataTransfer = async (dt: DataTransfer): Promise<string | null> => {
  // 1. Try URI-list (RFC 2483 / browser standard for dragged URLs)
  const uriList = dt.getData('text/uri-list');
  if (uriList) {
    const lines = uriList
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    if (lines.length > 0) {
      return normalizeDroppedUrl(lines[0]);
    }
  }

  // 2. Try plain text (often contains URL or domain)
  const plainText = dt.getData('text/plain')?.trim();
  if (plainText) {
    const urlMatch = plainText.match(/https?:\/\/[^\s"'<>]+/i);
    if (urlMatch) {
      return normalizeDroppedUrl(urlMatch[0]);
    }
    if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/[^\s]*)?$/.test(plainText)) {
      return normalizeDroppedUrl(`https://${plainText}`);
    }
  }

  // 3. Try HTML text (e.g. dragged hyperlink <a href="...">)
  const htmlText = dt.getData('text/html');
  if (htmlText) {
    const hrefMatch = htmlText.match(/href=["'](https?:\/\/[^"']+)["']/i);
    if (hrefMatch && hrefMatch[1]) {
      return normalizeDroppedUrl(hrefMatch[1]);
    }
  }

  // 4. Try files (e.g. .url internet shortcut, .webloc, or .txt file)
  if (dt.files && dt.files.length > 0) {
    const file = dt.files[0];
    const fileText = await readFileAsText(file);
    if (fileText) {
      const urlFileMatch = fileText.match(/URL=(https?:\/\/[^\r\n]+)/i);
      if (urlFileMatch && urlFileMatch[1]) {
        return normalizeDroppedUrl(urlFileMatch[1]);
      }
      const weblocMatch = fileText.match(/<string>(https?:\/\/[^<]+)<\/string>/i);
      if (weblocMatch && weblocMatch[1]) {
        return normalizeDroppedUrl(weblocMatch[1]);
      }
      const genericMatch = fileText.match(/https?:\/\/[^\s"'<>]+/i);
      if (genericMatch) {
        return normalizeDroppedUrl(genericMatch[0]);
      }
    }
  }

  return null;
};

export const InputForm: React.FC<InputFormProps> = ({
  onAnalyze,
  isLoading,
}) => {
  const [url, setUrl] = useState('');
  const [includeAi, setIncludeAi] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [droppedFeedback, setDroppedFeedback] = useState<string | null>(null);

  const dragCounter = useRef(0);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    dragCounter.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    e.dataTransfer.dropEffect = 'copy';
    if (!dragActive) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);

    if (isLoading) return;

    const foundUrl = await extractUrlFromDataTransfer(e.dataTransfer);
    if (foundUrl) {
      setUrl(foundUrl);
      setDroppedFeedback(`URL loaded: ${foundUrl}`);
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      feedbackTimeoutRef.current = setTimeout(() => {
        setDroppedFeedback(null);
      }, 4000);
      urlInputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    let rawUrl = url.trim();
    if (!rawUrl) {
      urlInputRef.current?.focus();
      return;
    }
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = `https://${rawUrl}`;
    }
    onAnalyze({ scan_url: rawUrl, include_ai: includeAi });
  };

  return (
    <div
      className="w-full max-w-[620px] mx-auto flex flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Floating Island Capsule */}
      <div
        id="analyse-island"
        className="w-full bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/70 transition-all duration-300 ease-out flex flex-col relative"
      >
        {/* Drag & Drop URL Overlay Feedback */}
        {dragActive && (
          <div
            id="drop-overlay"
            className="absolute inset-0 bg-amber-50/95 backdrop-blur-xs rounded-2xl border-2 border-dashed border-amber-500 z-30 flex flex-col items-center justify-center p-6 text-center shadow-lg transition-all animate-in fade-in zoom-in-95 duration-150 pointer-events-none"
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2.5 shadow-xs border border-amber-300">
              <Globe className="w-6 h-6 text-amber-700 animate-pulse" aria-hidden="true" />
            </div>
            <p className="font-serif text-lg font-semibold text-ink">Drop URL here</p>
            <p className="text-xs text-ink-muted mt-1 max-w-xs">
              Release to load website link for pattern inspection
            </p>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {droppedFeedback && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-1.5 min-w-0">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{droppedFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setDroppedFeedback(null)}
                className="text-emerald-700 hover:text-emerald-900 ml-2 shrink-0 cursor-pointer"
                aria-label="Dismiss feedback"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div
            id="url-input-container"
            className="flex items-center bg-surface-container-high px-4 py-3 rounded-xl border border-outline-variant/50 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all relative"
          >
            <Globe className="w-5 h-5 text-outline mr-3 shrink-0" aria-hidden="true" />
            <input
              ref={urlInputRef}
              id="scan-url-input"
              className="w-full bg-transparent border-0 outline-none font-mono text-sm text-ink placeholder:text-outline/70 focus:outline-none"
              placeholder="https://example-shop.com (or drag URL here)"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {url && !isLoading && (
              <button
                type="button"
                onClick={() => {
                  setUrl('');
                  urlInputRef.current?.focus();
                }}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-md transition-colors cursor-pointer shrink-0 ml-1"
                aria-label="Clear URL input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Plain words limits disclosure */}
          <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-ink-muted space-y-1">
            <span className="font-semibold text-ink block">
              Scan limits: Up to 8 pages; AI on at most 5.
            </span>
            <p className="leading-relaxed">
              Discovers and prioritises key transactional pages: pricing, cart, checkout, registration, cancellation, and consent. Respects robots.txt and concurrency of 1.
            </p>
          </div>

          {/* Smooth on/off card & switch for AI */}
          <div
            role="button"
            tabIndex={isLoading ? -1 : 0}
            onClick={() => !isLoading && setIncludeAi(!includeAi)}
            onKeyDown={(e) => {
              if (isLoading) return;
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setIncludeAi(!includeAi);
              }
            }}
            aria-label="Toggle AI analysis"
            aria-pressed={includeAi}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 select-none ${
              isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            } ${
              includeAi
                ? 'bg-amber-50/80 border-amber-300 shadow-[0_1px_4px_rgba(245,158,11,0.08)]'
                : 'bg-surface-container-low/50 border-outline-variant/40 hover:bg-surface-container-low hover:border-outline-variant/70'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                  includeAi
                    ? 'bg-amber-400/25 text-amber-800 rotate-6 scale-105 shadow-xs'
                    : 'bg-stone-200/60 text-stone-500 rotate-0 scale-100'
                }`}
              >
                <Sparkles className="w-4 h-4 transition-transform duration-300" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-ink">
                    AI analysis
                  </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-colors duration-300 ${
                      includeAi
                        ? 'bg-amber-200/90 text-amber-900 border border-amber-300'
                        : 'bg-stone-200 text-stone-600 border border-stone-300'
                    }`}
                  >
                    {includeAi ? 'ON' : 'OFF'}
                  </span>
                </div>
                <span className="text-[11px] text-ink-muted block truncate mt-0.5 transition-colors duration-300">
                  {includeAi
                    ? 'Deep pattern inspection enabled on top 5 pages'
                    : 'Operating in deterministic rules-only mode'}
                </span>
              </div>
            </div>

            {/* Precision smooth toggle track & thumb */}
            <div
              role="switch"
              aria-checked={includeAi}
              aria-label="Toggle AI analysis switch"
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ease-out focus:outline-none ${
                includeAi
                  ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]'
                  : 'bg-stone-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-300 ease-out ${
                  includeAi ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="mt-2">
            <button
              id="btn-submit-analyse"
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className={`w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-bold transition-all flex items-center justify-center gap-2 shadow-sm text-base tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                isLoading
                  ? 'opacity-60 cursor-not-allowed'
                  : 'cursor-pointer active:scale-[0.99]'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Scanning site priority pages...</span>
                </>
              ) : (
                <>
                  <Globe className="w-5 h-5" aria-hidden="true" />
                  <span>Analyse site</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Privacy Note */}
      <div className="mt-4 flex items-center justify-center gap-2 text-center text-ink-muted text-xs">
        <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Pages are analysed in your browser session and not permanently stored.</span>
      </div>
    </div>
  );
};
