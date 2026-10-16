import React, { useState, useRef } from 'react';
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
  CheckSquare
} from 'lucide-react';
import { CorpusItem } from '../types';

interface InputFormProps {
  onAnalyze: (payload: { url?: string; html_content?: string; corpus_id?: string; include_ai?: boolean }) => void;
  isLoading: boolean;
  corpusList: CorpusItem[];
  onCategoryFilter?: (category: 'hidden_charges' | 'cancellation' | 'consent') => void;
}

export const InputForm: React.FC<InputFormProps> = ({
  onAnalyze,
  isLoading,
  corpusList,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'screenshots' | 'samples'>('url');
  const [url, setUrl] = useState('');
  const [includeAi, setIncludeAi] = useState(true);
  const [selectedCorpusId, setSelectedCorpusId] = useState<string>('consent_asymmetric_buttons');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedContent, setUploadedContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setUploadedFileName(file.name);
    const reader = new FileReader();
    if (file.name.endsWith('.html') || file.name.endsWith('.htm') || file.type === 'text/html' || file.type.startsWith('text/')) {
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setUploadedContent(text);
      };
      reader.readAsText(file);
    } else {
      // Image file: read as data URL
      reader.onload = (event) => {
        const base64Url = event.target?.result as string;
        // Wrap in simple HTML container so extractor/vision can parse
        const mockHtml = `<!DOCTYPE html><html><head><title>${file.name}</title></head><body><img src="${base64Url}" style="max-width:100%;" alt="Uploaded Document" /></body></html>`;
        setUploadedContent(mockHtml);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (activeTab === 'url') {
      if (!url.trim()) return;
      onAnalyze({ url: url.trim(), include_ai: includeAi });
    } else if (activeTab === 'screenshots') {
      if (!uploadedContent) return;
      onAnalyze({ html_content: uploadedContent, include_ai: includeAi });
    } else if (activeTab === 'samples') {
      onAnalyze({ corpus_id: selectedCorpusId, include_ai: includeAi });
    }
  };

  const handleSelectSample = (id: string) => {
    setSelectedCorpusId(id);
    onAnalyze({ corpus_id: id, include_ai: includeAi });
  };

  const renderCorpusIcon = (cat: string) => {
    switch (cat) {
      case 'hidden_charges': return <CreditCard className="w-5 h-5 text-primary dark:text-[#2DD4BF]" aria-hidden="true" />;
      case 'cancellation': return <Ban className="w-5 h-5 text-secondary dark:text-[#E2E8F0]" aria-hidden="true" />;
      case 'consent': return <ShieldAlert className="w-5 h-5 text-primary dark:text-[#2DD4BF]" aria-hidden="true" />;
      default: return <Search className="w-5 h-5 text-primary dark:text-[#2DD4BF]" aria-hidden="true" />;
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* Container Card */}
      <div className="bg-surface-container-lowest dark:bg-[#111A2E] rounded-xl p-space-md sm:p-space-lg shadow-[0px_1px_3px_rgba(15,23,42,0.04)] border border-outline-variant/30 dark:border-[#26324A] mb-space-lg">
        {/* Input Switch Tabs */}
        <div className="flex bg-surface-container-low dark:bg-[#0B1220] p-1 rounded-lg mb-space-md" role="tablist">
          <button
            type="button"
            id="tab-url"
            role="tab"
            aria-selected={activeTab === 'url'}
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 text-center text-sm rounded-md transition-all font-medium ${
              activeTab === 'url'
                ? 'bg-surface-container-lowest dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] shadow-sm font-semibold'
                : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0]'
            }`}
          >
            URL
          </button>
          <button
            type="button"
            id="tab-screenshots"
            role="tab"
            aria-selected={activeTab === 'screenshots'}
            onClick={() => setActiveTab('screenshots')}
            className={`flex-1 py-2 text-center text-sm rounded-md transition-all font-medium ${
              activeTab === 'screenshots'
                ? 'bg-surface-container-lowest dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] shadow-sm font-semibold'
                : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0]'
            }`}
          >
            Screenshots
          </button>
          <button
            type="button"
            id="tab-samples"
            role="tab"
            aria-selected={activeTab === 'samples'}
            onClick={() => setActiveTab('samples')}
            className={`flex-1 py-2 text-center text-sm rounded-md transition-all font-medium ${
              activeTab === 'samples'
                ? 'bg-surface-container-lowest dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] shadow-sm font-semibold'
                : 'text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0]'
            }`}
          >
            Sample pages
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit}>
          {/* Tab Content: URL */}
          {activeTab === 'url' && (
            <div className="space-y-space-md" id="content-url" role="tabpanel">
              <div>
                <label htmlFor="url-input" className="block text-sm text-on-surface-variant dark:text-[#94A3B8] mb-space-xs font-medium">
                  Target Web Address
                </label>
                <div className="flex items-center bg-surface-container-low dark:bg-[#0B1220] rounded-lg px-space-md h-12 focus-within:ring-2 focus-within:ring-primary border border-outline-variant/30 dark:border-[#26324A] transition-all">
                  <Link2 className="w-5 h-5 text-outline dark:text-[#94A3B8] mr-space-sm shrink-0" aria-hidden="true" />
                  <input
                    id="url-input"
                    className="w-full bg-transparent text-sm text-on-surface dark:text-[#E2E8F0] focus:outline-none placeholder:text-outline"
                    placeholder="https://example.com/checkout"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              </div>

              {/* AI analysis toggle */}
              <div className="flex items-center justify-between py-space-xs">
                <div className="flex items-center gap-space-sm">
                  <Sparkles className="w-5 h-5 text-primary dark:text-[#2DD4BF]" aria-hidden="true" />
                  <div>
                    <span className="text-sm font-medium text-on-surface dark:text-[#E2E8F0] block">AI analysis</span>
                    <span className="text-sm text-on-surface-variant dark:text-[#94A3B8] block">Deep pattern inspection & anti-hallucination quote check</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAi}
                    onChange={(e) => setIncludeAi(e.target.checked)}
                    className="sr-only peer"
                    aria-label="Toggle AI analysis"
                  />
                  <div className="w-11 h-6 bg-surface-container-highest dark:bg-[#26324A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container dark:peer-checked:bg-[#005c55]"></div>
                </label>
              </div>
            </div>
          )}

          {/* Tab Content: Screenshots */}
          {activeTab === 'screenshots' && (
            <div className="space-y-space-md" id="content-screenshots" role="tabpanel">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-space-lg text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[180px] ${
                  dragActive
                    ? 'border-primary bg-primary-fixed/20 dark:bg-[#2DD4BF]/10'
                    : 'border-outline-variant/60 dark:border-[#26324A] bg-surface-container-low dark:bg-[#0B1220] hover:bg-surface-container dark:hover:bg-[#111A2E]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.html,.htm"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Upload document"
                />
                <div className="w-12 h-12 rounded-full bg-primary-fixed dark:bg-[#2DD4BF]/20 flex items-center justify-center mb-space-sm text-primary dark:text-[#2DD4BF]">
                  <UploadCloud className="w-6 h-6" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-on-surface dark:text-[#E2E8F0] mb-space-xs">
                  {uploadedFileName ? `Selected: ${uploadedFileName}` : 'Drag and drop your screenshot or HTML here'}
                </p>
                <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] mb-space-md">
                  Supports PNG, JPG, WEBP, or HTML files up to 15MB
                </p>
                <button
                  type="button"
                  className="px-space-md py-2 rounded-lg bg-surface-container-lowest dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] shadow-sm border border-outline-variant/40 dark:border-[#26324A] hover:bg-surface-container transition-all text-sm font-semibold"
                >
                  {uploadedFileName ? 'Choose another file' : 'Choose files'}
                </button>
              </div>

              {/* AI analysis toggle for screenshots */}
              <div className="flex items-center justify-between py-space-xs">
                <div className="flex items-center gap-space-sm">
                  <Sparkles className="w-5 h-5 text-primary dark:text-[#2DD4BF]" aria-hidden="true" />
                  <div>
                    <span className="text-sm font-medium text-on-surface dark:text-[#E2E8F0] block">AI vision inspection</span>
                    <span className="text-sm text-on-surface-variant dark:text-[#94A3B8] block">Analyze visual emphasis & layout asymmetry</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAi}
                    onChange={(e) => setIncludeAi(e.target.checked)}
                    className="sr-only peer"
                    aria-label="Toggle AI vision inspection"
                  />
                  <div className="w-11 h-6 bg-surface-container-highest dark:bg-[#26324A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container dark:peer-checked:bg-[#005c55]"></div>
                </label>
              </div>
            </div>
          )}

          {/* Tab Content: Sample Pages */}
          {activeTab === 'samples' && (
            <div className="space-y-space-sm max-h-72 overflow-y-auto pr-1" id="content-samples" role="tabpanel">
              {corpusList.length > 0 ? (
                corpusList.map((item) => {
                  const isSelected = selectedCorpusId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSample(item.id)}
                      className={`p-space-md rounded-lg cursor-pointer transition-all flex items-center justify-between group border ${
                        isSelected
                          ? 'bg-primary-fixed/20 dark:bg-[#2DD4BF]/10 border-primary-container dark:border-[#2DD4BF] shadow-sm'
                          : 'bg-surface-container-low dark:bg-[#0B1220] hover:bg-surface-container dark:hover:bg-[#111A2E] border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-space-md">
                        {renderCorpusIcon(item.category)}
                        <div>
                          <h4 className="text-sm font-medium text-on-surface dark:text-[#E2E8F0] group-hover:text-primary dark:group-hover:text-[#2DD4BF] transition-colors">
                            {item.notes || item.id}
                          </h4>
                          <p className="text-sm text-on-surface-variant dark:text-[#94A3B8]">
                            {item.patterns.length > 0
                              ? `Deceptive: ${item.patterns.join(', ')}`
                              : 'Clean fair design control (negative example)'}
                          </p>
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle className="w-5 h-5 text-primary dark:text-[#2DD4BF]" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-outline dark:text-[#94A3B8]" aria-hidden="true" />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-on-surface-variant dark:text-[#94A3B8] text-sm">
                  Loading ground-truth sample pages...
                </div>
              )}
            </div>
          )}

          {/* Primary Action Button */}
          <div className="mt-space-lg">
            <button
              type="submit"
              disabled={isLoading || (activeTab === 'screenshots' && !uploadedContent) || (activeTab === 'url' && !url.trim())}
              className={`w-full h-12 bg-primary-container dark:bg-[#005c55] text-on-primary-container dark:text-white rounded-lg flex items-center justify-center gap-space-sm shadow-sm transition-all text-base font-semibold ${
                isLoading || (activeTab === 'screenshots' && !uploadedContent) || (activeTab === 'url' && !url.trim())
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:opacity-95 cursor-pointer active:scale-[0.99]'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Analysing patterns...</span>
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
        <div className="mt-space-md flex items-center justify-center gap-space-xs text-center">
          <Lock className="w-4 h-4 text-outline dark:text-[#94A3B8]" aria-hidden="true" />
          <p className="text-sm text-on-surface-variant dark:text-[#94A3B8]">
            Pages are analysed in your browser session and not permanently stored.
          </p>
        </div>
      </div>

      {/* Focus Cards Section: Common Deceptive Patterns */}
      <div className="mb-space-md">
        <h3 className="text-lg font-semibold text-on-surface dark:text-[#E2E8F0] mb-space-sm">
          Common deceptive patterns
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
        <Link
          to="/methodology#hidden-charges"
          className="bg-surface-container-lowest dark:bg-[#111A2E] rounded-xl p-space-md shadow-[0px_1px_3px_rgba(15,23,42,0.04)] border border-outline-variant/30 dark:border-[#26324A] flex items-center gap-space-md cursor-pointer hover:border-outline-variant dark:hover:border-outline transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-error-container dark:bg-[#B91C1C]/20 text-on-error-container dark:text-[#B91C1C] flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-on-error-container dark:text-[#B91C1C]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-on-surface dark:text-[#E2E8F0] group-hover:text-primary dark:group-hover:text-[#2DD4BF] text-sm transition-colors">Hidden charges</h4>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] truncate">Mandatory fees added at checkout</p>
          </div>
        </Link>

        <Link
          to="/methodology#cancellation"
          className="bg-surface-container-lowest dark:bg-[#111A2E] rounded-xl p-space-md shadow-[0px_1px_3px_rgba(15,23,42,0.04)] border border-outline-variant/30 dark:border-[#26324A] flex items-center gap-space-md cursor-pointer hover:border-outline-variant dark:hover:border-outline transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-secondary-fixed dark:bg-[#565e74]/30 text-on-secondary-fixed dark:text-[#E2E8F0] flex items-center justify-center shrink-0">
            <Ban className="w-5 h-5 text-on-secondary-fixed dark:text-[#E2E8F0]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-on-surface dark:text-[#E2E8F0] group-hover:text-primary dark:group-hover:text-[#2DD4BF] text-sm transition-colors">Cancellation</h4>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] truncate">Concealed links or forced phone calls</p>
          </div>
        </Link>

        <Link
          to="/methodology#consent"
          className="bg-surface-container-lowest dark:bg-[#111A2E] rounded-xl p-space-md shadow-[0px_1px_3px_rgba(15,23,42,0.04)] border border-outline-variant/30 dark:border-[#26324A] flex items-center gap-space-md cursor-pointer hover:border-outline-variant dark:hover:border-outline transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-primary-fixed dark:bg-[#2DD4BF]/20 text-on-primary-fixed dark:text-[#2DD4BF] flex items-center justify-center shrink-0">
            <CheckSquare className="w-5 h-5 text-on-primary-fixed dark:text-[#2DD4BF]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-on-surface dark:text-[#E2E8F0] group-hover:text-primary dark:group-hover:text-[#2DD4BF] text-sm transition-colors">Consent</h4>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] truncate">Pre-ticked boxes for data sharing</p>
          </div>
        </Link>
      </div>
    </div>
  );
};
