import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Link2,
  Sparkles,
  UploadCloud,
  CreditCard,
  Ban,
  ShieldAlert,
  CheckCircle,
  ChevronRight,
  Loader2,
  Search,
  Lock,
  CheckSquare,
  Globe,
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
  corpusList: CorpusItem[];
}

export const InputForm: React.FC<InputFormProps> = ({
  onAnalyze,
  isLoading,
  corpusList,
}) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'url' | 'screenshots' | 'samples'>('url');
  const [url, setUrl] = useState('');
  const [includeAi, setIncludeAi] = useState(false);
  const [selectedCorpusId, setSelectedCorpusId] = useState<string>('consent_asymmetric_buttons');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedContent, setUploadedContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (corpusList.length > 0 && !corpusList.some((item) => item.id === selectedCorpusId)) {
      setSelectedCorpusId(corpusList[0].id);
    }
  }, [corpusList, selectedCorpusId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading) return;
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const processFile = (file: File) => {
    setUploadedFileName(file.name);
    const reader = new FileReader();
    const lowerName = file.name.toLowerCase();
    if (
      lowerName.endsWith('.html') ||
      lowerName.endsWith('.htm') ||
      file.type === 'text/html' ||
      file.type.startsWith('text/')
    ) {
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setUploadedContent(text);
      };
      reader.onerror = () => {
        console.error('Failed to read file:', file.name);
      };
      reader.readAsText(file);
    } else {
      // Image file: read as data URL
      reader.onload = (event) => {
        const base64Url = event.target?.result as string;
        const mockHtml = `<!DOCTYPE html><html><head><title>${file.name}</title></head><body><img src="${base64Url}" style="max-width:100%;" alt="Uploaded Document" /></body></html>`;
        setUploadedContent(mockHtml);
      };
      reader.onerror = () => {
        console.error('Failed to read file:', file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (isLoading) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (activeTab === 'scan') {
      let rawUrl = url.trim();
      if (!rawUrl) {
        urlInputRef.current?.focus();
        return;
      }
      if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = `https://${rawUrl}`;
      }
      onAnalyze({ scan_url: rawUrl, include_ai: includeAi });
    } else if (activeTab === 'url') {
      let rawUrl = url.trim();
      if (!rawUrl) {
        urlInputRef.current?.focus();
        return;
      }
      // Auto-prepend https:// if user entered domain without protocol
      if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = `https://${rawUrl}`;
      }
      onAnalyze({ url: rawUrl, include_ai: includeAi });
    } else if (activeTab === 'screenshots') {
      if (!uploadedContent) {
        fileInputRef.current?.click();
        return;
      }
      onAnalyze({ html_content: uploadedContent, include_ai: includeAi });
    } else if (activeTab === 'samples') {
      if (!selectedCorpusId || corpusList.length === 0) return;
      onAnalyze({ corpus_id: selectedCorpusId, include_ai: includeAi });
    }
  };

  const handleSelectSample = (id: string) => {
    if (isLoading) return;
    setSelectedCorpusId(id);
    onAnalyze({ corpus_id: id, include_ai: includeAi });
  };

  const renderCorpusIcon = (cat: string) => {
    switch (cat) {
      case 'hidden_charges':
        return <CreditCard className="w-5 h-5 text-red-pen shrink-0" aria-hidden="true" />;
      case 'cancellation':
        return <Ban className="w-5 h-5 text-ink-muted dark:text-[#94A3B8] shrink-0" aria-hidden="true" />;
      case 'consent':
        return <ShieldAlert className="w-5 h-5 text-ink dark:text-[#2DD4BF] shrink-0" aria-hidden="true" />;
      default:
        return <Search className="w-5 h-5 text-ink dark:text-[#2DD4BF] shrink-0" aria-hidden="true" />;
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* Container Card */}
      <div className="bg-white dark:bg-[#111A2E] rounded-sm p-6 shadow-sm border border-border-hairline dark:border-[#26324A] mb-8">
        {/* Input Switch Tabs */}
        <div className="flex bg-paper dark:bg-[#0B1220] p-1 rounded-sm mb-6 border border-border-hairline dark:border-[#26324A]" role="tablist">
          <button
            type="button"
            id="tab-scan"
            role="tab"
            aria-selected={activeTab === 'scan'}
            aria-controls="content-scan"
            onClick={() => setActiveTab('scan')}
            className={`flex-1 py-2 text-center text-sm rounded-sm transition-all font-medium ${
              activeTab === 'scan'
                ? 'bg-white dark:bg-[#111A2E] text-ink dark:text-[#E2E8F0] shadow-sm font-semibold'
                : 'text-ink-muted dark:text-[#94A3B8] hover:text-ink dark:hover:text-[#E2E8F0]'
            }`}
          >
            Scan this site
          </button>
          <button
            type="button"
            id="tab-url"
            role="tab"
            aria-selected={activeTab === 'url'}
            aria-controls="content-url"
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 text-center text-sm rounded-sm transition-all font-medium ${
              activeTab === 'url'
                ? 'bg-white dark:bg-[#111A2E] text-ink dark:text-[#E2E8F0] shadow-sm font-semibold'
                : 'text-ink-muted dark:text-[#94A3B8] hover:text-ink dark:hover:text-[#E2E8F0]'
            }`}
          >
            Single page
          </button>
          <button
            type="button"
            id="tab-screenshots"
            role="tab"
            aria-selected={activeTab === 'screenshots'}
            aria-controls="content-screenshots"
            onClick={() => setActiveTab('screenshots')}
            className={`flex-1 py-2 text-center text-sm rounded-sm transition-all font-medium ${
              activeTab === 'screenshots'
                ? 'bg-white dark:bg-[#111A2E] text-ink dark:text-[#E2E8F0] shadow-sm font-semibold'
                : 'text-ink-muted dark:text-[#94A3B8] hover:text-ink dark:hover:text-[#E2E8F0]'
            }`}
          >
            Screenshots
          </button>
          <button
            type="button"
            id="tab-samples"
            role="tab"
            aria-selected={activeTab === 'samples'}
            aria-controls="content-samples"
            onClick={() => setActiveTab('samples')}
            className={`flex-1 py-2 text-center text-sm rounded-sm transition-all font-medium ${
              activeTab === 'samples'
                ? 'bg-white dark:bg-[#111A2E] text-ink dark:text-[#E2E8F0] shadow-sm font-semibold'
                : 'text-ink-muted dark:text-[#94A3B8] hover:text-ink dark:hover:text-[#E2E8F0]'
            }`}
          >
            Sample pages
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit}>
          {/* Tab Content: Scan this site */}
          {activeTab === 'scan' && (
            <div className="space-y-4" id="content-scan" role="tabpanel" aria-labelledby="tab-scan">
              <div>
                <label htmlFor="scan-url-input" className="block text-sm text-ink-muted dark:text-[#94A3B8] mb-1.5 font-medium">
                  Site or Domain Web Address
                </label>
                <div className="flex items-center bg-paper dark:bg-[#0B1220] rounded-sm px-4 h-12 border border-border-hairline dark:border-[#26324A] focus-within:border-ink dark:focus-within:border-[#2DD4BF] transition-all">
                  <Globe className="w-5 h-5 text-ink-muted dark:text-[#94A3B8] mr-3 shrink-0" aria-hidden="true" />
                  <input
                    ref={urlInputRef}
                    id="scan-url-input"
                    className="w-full bg-transparent text-sm text-ink dark:text-[#E2E8F0] focus:outline-none placeholder:text-ink-muted/60"
                    placeholder="https://example-shop.com"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              </div>

              {/* Plain words limits disclosure */}
              <div className="p-3.5 rounded-sm bg-paper/70 dark:bg-[#0B1220]/70 border border-border-hairline dark:border-[#26324A] text-xs text-ink-muted dark:text-[#94A3B8] space-y-1">
                <span className="font-semibold text-ink dark:text-[#E2E8F0] block">
                  Scan limits: Up to 8 pages; AI on at most 5.
                </span>
                <p>
                  Discovers and prioritises key transactional pages: pricing, cart, checkout, registration, cancellation, and consent. Keeps concurrency to 1 per domain with polite delay and robots.txt obedience.
                </p>
              </div>

              {/* Plain on/off toggle for AI with state written out */}
              <div className="flex items-center justify-between py-2 border-t border-border-hairline dark:border-[#26324A]">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-ink dark:text-[#2DD4BF]" aria-hidden="true" />
                  <div>
                    <span className="text-sm font-semibold text-ink dark:text-[#E2E8F0] block">
                      {includeAi ? 'AI analysis: ON' : 'AI analysis: OFF'}
                    </span>
                    <span className="text-xs text-ink-muted dark:text-[#94A3B8] block">
                      {includeAi ? 'Deep pattern inspection enabled on top 5 pages' : 'Operating in deterministic rules-only mode (No AI calls)'}
                    </span>
                  </div>
                </div>
                <label className={`relative inline-flex items-center ${isLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={includeAi}
                    disabled={isLoading}
                    onChange={(e) => setIncludeAi(e.target.checked)}
                    className="sr-only peer"
                    aria-label="Toggle AI analysis"
                  />
                  <div className="w-11 h-6 bg-paper dark:bg-[#26324A] border border-border-hairline dark:border-[#26324A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink dark:peer-checked:bg-[#2DD4BF]"></div>
                </label>
              </div>
            </div>
          )}

          {/* Tab Content: URL */}
          {activeTab === 'url' && (
            <div className="space-y-4" id="content-url" role="tabpanel" aria-labelledby="tab-url">
              <div>
                <label htmlFor="url-input" className="block text-sm text-ink-muted dark:text-[#94A3B8] mb-1.5 font-medium">
                  Target Web Address
                </label>
                <div className="flex items-center bg-paper dark:bg-[#0B1220] rounded-sm px-4 h-12 border border-border-hairline dark:border-[#26324A] focus-within:border-ink dark:focus-within:border-[#2DD4BF] transition-all">
                  <Link2 className="w-5 h-5 text-ink-muted dark:text-[#94A3B8] mr-3 shrink-0" aria-hidden="true" />
                  <input
                    ref={urlInputRef}
                    id="url-input"
                    className="w-full bg-transparent text-sm text-ink dark:text-[#E2E8F0] focus:outline-none placeholder:text-ink-muted/60"
                    placeholder="https://example.com/checkout"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              </div>

              {/* AI analysis toggle */}
              <div className="flex items-center justify-between py-2 border-t border-border-hairline dark:border-[#26324A] mt-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-ink dark:text-[#2DD4BF]" aria-hidden="true" />
                  <div>
                    <span className="text-sm font-semibold text-ink dark:text-[#E2E8F0] block">
                      {includeAi ? 'AI analysis: ON' : 'AI analysis: OFF'}
                    </span>
                    <span className="text-xs text-ink-muted dark:text-[#94A3B8] block">
                      {includeAi ? 'Deep pattern inspection enabled' : 'Operating in deterministic rules-only mode'}
                    </span>
                  </div>
                </div>
                <label className={`relative inline-flex items-center ${isLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={includeAi}
                    disabled={isLoading}
                    onChange={(e) => setIncludeAi(e.target.checked)}
                    className="sr-only peer"
                    aria-label="Toggle AI analysis"
                  />
                  <div className="w-11 h-6 bg-paper dark:bg-[#26324A] border border-border-hairline dark:border-[#26324A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink dark:peer-checked:bg-[#2DD4BF]"></div>
                </label>
              </div>
            </div>
          )}

          {/* Tab Content: Screenshots */}
          {activeTab === 'screenshots' && (
            <div className="space-y-4" id="content-screenshots" role="tabpanel" aria-labelledby="tab-screenshots">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !isLoading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-sm p-6 text-center transition-all flex flex-col items-center justify-center min-h-[180px] ${
                  isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  dragActive
                    ? 'border-ink bg-paper dark:border-[#2DD4BF] dark:bg-[#0B1220]'
                    : 'border-border-hairline dark:border-[#26324A] bg-paper/60 dark:bg-[#0B1220]/60 hover:border-ink-muted'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,text/html,.html,.htm"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <UploadCloud className="w-10 h-10 text-ink-muted dark:text-[#94A3B8] mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-ink dark:text-[#E2E8F0]">
                  {uploadedFileName ? (
                    <span className="text-ink dark:text-[#2DD4BF] font-mono">{uploadedFileName}</span>
                  ) : (
                    'Click to upload or drag & drop files here'
                  )}
                </p>
                <p className="text-xs text-ink-muted dark:text-[#94A3B8] mt-1">
                  Supported formats: PNG, JPG, WebP, or rendered HTML export
                </p>
              </div>

              {/* AI toggle for screenshots */}
              <div className="flex items-center justify-between py-2 border-t border-border-hairline dark:border-[#26324A]">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-ink dark:text-[#2DD4BF]" aria-hidden="true" />
                  <div>
                    <span className="text-sm font-semibold text-ink dark:text-[#E2E8F0] block">
                      {includeAi ? 'AI analysis: ON' : 'AI analysis: OFF'}
                    </span>
                    <span className="text-xs text-ink-muted dark:text-[#94A3B8] block">
                      {includeAi ? 'Gemini multi-modal vision inspection enabled' : 'Operating in deterministic rules-only mode'}
                    </span>
                  </div>
                </div>
                <label className={`relative inline-flex items-center ${isLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={includeAi}
                    disabled={isLoading}
                    onChange={(e) => setIncludeAi(e.target.checked)}
                    className="sr-only peer"
                    aria-label="Toggle AI vision inspection"
                  />
                  <div className="w-11 h-6 bg-paper dark:bg-[#26324A] border border-border-hairline dark:border-[#26324A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink dark:peer-checked:bg-[#2DD4BF]"></div>
                </label>
              </div>
            </div>
          )}

          {/* Tab Content: Sample Pages */}
          {activeTab === 'samples' && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1" id="content-samples" role="tabpanel" aria-labelledby="tab-samples">
              {corpusList.length > 0 ? (
                corpusList.map((item) => {
                  const isSelected = selectedCorpusId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => !isLoading && handleSelectSample(item.id)}
                      className={`p-4 rounded-sm transition-all flex items-center justify-between group border ${
                        isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        isSelected
                          ? 'bg-paper dark:bg-[#0B1220] border-2 border-ink dark:border-[#2DD4BF] shadow-sm'
                          : 'bg-white dark:bg-[#111A2E] hover:bg-paper dark:hover:bg-[#0B1220] border-border-hairline dark:border-[#26324A]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {renderCorpusIcon(item.category)}
                        <div>
                          <h4 className="text-sm font-medium text-ink dark:text-[#E2E8F0] group-hover:text-red-pen transition-colors">
                            {item.notes || item.id}
                          </h4>
                          <p className="text-xs text-ink-muted dark:text-[#94A3B8]">
                            {item.patterns.length > 0
                              ? `Deceptive: ${item.patterns.join(', ')}`
                              : 'Clean fair design control (negative control fixture)'}
                          </p>
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle className="w-5 h-5 text-ink dark:text-[#2DD4BF] shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-border-hairline dark:border-[#26324A] shrink-0" aria-hidden="true" />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-ink-muted dark:text-[#94A3B8] text-sm">
                  Loading ground-truth sample pages...
                </div>
              )}
            </div>
          )}

          {/* Primary Action Button */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className={`w-full h-12 bg-ink dark:bg-[#2DD4BF] text-paper dark:text-[#0B1220] rounded-sm flex items-center justify-center gap-2 shadow-sm transition-all text-base font-semibold ${
                isLoading
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:bg-ink/90 dark:hover:bg-[#2DD4BF]/90 cursor-pointer active:scale-[0.99]'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>{activeTab === 'scan' ? 'Scanning site priority pages...' : 'Analysing interface patterns...'}</span>
                </>
              ) : activeTab === 'scan' ? (
                <>
                  <Globe className="w-5 h-5" aria-hidden="true" />
                  <span>Scan this site (up to 8 pages)</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" aria-hidden="true" />
                  <span>Analyse page</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Privacy Note */}
        <div className="mt-4 flex items-center justify-center gap-2 text-center">
          <Lock className="w-3.5 h-3.5 text-ink-muted dark:text-[#94A3B8]" aria-hidden="true" />
          <p className="text-xs text-ink-muted dark:text-[#94A3B8] font-mono">
            Analysis is processed ephemerally in your browser session. No personal browsing data is retained.
          </p>
        </div>
      </div>

      {/* Focus Cards Section: Common Deceptive Patterns */}
      <div className="mb-3">
        <h3 className="font-serif text-lg font-semibold text-ink dark:text-[#E2E8F0]">
          Verified detection categories
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/methodology#hidden-charges"
          className="bg-white dark:bg-[#111A2E] rounded-sm p-4 shadow-sm border border-border-hairline dark:border-[#26324A] flex items-center gap-3 cursor-pointer hover:border-red-pen transition-all group"
        >
          <div className="w-9 h-9 rounded-full bg-red-tint dark:bg-[#B91C1C]/20 text-red-pen flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4 text-red-pen" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-ink dark:text-[#E2E8F0] group-hover:text-red-pen text-sm transition-colors">
              Hidden charges
            </h4>
            <p className="text-xs text-ink-muted dark:text-[#94A3B8] truncate">Mandatory fees withheld until payment</p>
          </div>
        </Link>

        <Link
          to="/methodology#cancellation"
          className="bg-white dark:bg-[#111A2E] rounded-sm p-4 shadow-sm border border-border-hairline dark:border-[#26324A] flex items-center gap-3 cursor-pointer hover:border-red-pen transition-all group"
        >
          <div className="w-9 h-9 rounded-full bg-paper dark:bg-[#26324A] text-ink-muted dark:text-[#94A3B8] flex items-center justify-center shrink-0">
            <Ban className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-ink dark:text-[#E2E8F0] group-hover:text-red-pen text-sm transition-colors">
              Cancellation
            </h4>
            <p className="text-xs text-ink-muted dark:text-[#94A3B8] truncate">Concealed links or forced phone calls</p>
          </div>
        </Link>

        <Link
          to="/methodology#consent"
          className="bg-white dark:bg-[#111A2E] rounded-sm p-4 shadow-sm border border-border-hairline dark:border-[#26324A] flex items-center gap-3 cursor-pointer hover:border-red-pen transition-all group"
        >
          <div className="w-9 h-9 rounded-full bg-paper dark:bg-[#26324A] text-ink dark:text-[#2DD4BF] flex items-center justify-center shrink-0">
            <CheckSquare className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-ink dark:text-[#E2E8F0] group-hover:text-red-pen text-sm transition-colors">
              Consent
            </h4>
            <p className="text-xs text-ink-muted dark:text-[#94A3B8] truncate">Pre-ticked boxes & asymmetric buttons</p>
          </div>
        </Link>
      </div>
    </div>
  );
};
