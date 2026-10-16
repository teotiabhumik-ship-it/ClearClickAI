import React, { useState, useRef } from 'react';
import { CorpusItem } from '../types';

interface InputFormProps {
  onAnalyze: (payload: { url?: string; html_content?: string; corpus_id?: string; include_ai?: boolean }) => void;
  onOpenBenchmark: () => void;
  isLoading: boolean;
  corpusList: CorpusItem[];
  onCategoryFilter?: (category: 'hidden_charges' | 'cancellation' | 'consent') => void;
}

export const InputForm: React.FC<InputFormProps> = ({
  onAnalyze,
  onOpenBenchmark,
  isLoading,
  corpusList,
  onCategoryFilter,
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

  // Icon mapping for corpus sample cards
  const getCorpusIcon = (cat: string) => {
    switch (cat) {
      case 'hidden_charges': return 'payments';
      case 'cancellation': return 'block';
      case 'consent': return 'cookie';
      default: return 'travel_explore';
    }
  };

  return (
    <div className="w-full">
      {/* Interactive Input Card */}
      <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-[0px_1px_3px_rgba(15,23,42,0.04)] border border-outline-variant/30 mb-space-lg">
        {/* Tabs Header */}
        <div className="flex bg-surface-container p-1 rounded-lg mb-space-md">
          <button
            type="button"
            id="tab-url"
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 text-center text-label-md rounded-md transition-all font-medium ${
              activeTab === 'url'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            URL
          </button>
          <button
            type="button"
            id="tab-screenshots"
            onClick={() => setActiveTab('screenshots')}
            className={`flex-1 py-2 text-center text-label-md rounded-md transition-all font-medium ${
              activeTab === 'screenshots'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Screenshots
          </button>
          <button
            type="button"
            id="tab-samples"
            onClick={() => setActiveTab('samples')}
            className={`flex-1 py-2 text-center text-label-md rounded-md transition-all font-medium ${
              activeTab === 'samples'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Sample pages
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit}>
          {/* Tab Content: URL */}
          {activeTab === 'url' && (
            <div className="space-y-space-md" id="content-url">
              <div>
                <label className="block font-label-md text-on-surface-variant mb-space-xs font-medium">
                  Target Web Address
                </label>
                <div className="flex items-center bg-surface-container-low rounded-lg px-space-md h-12 focus-within:ring-2 focus-within:ring-primary-container border border-outline-variant/30 transition-all">
                  <span className="material-symbols-outlined text-outline mr-space-sm text-[20px]">link</span>
                  <input
                    className="w-full bg-transparent font-body-md text-on-surface focus:outline-none placeholder:text-outline"
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
                  <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    smart_toy
                  </span>
                  <div>
                    <span className="font-body-md font-medium text-on-surface block">AI analysis</span>
                    <span className="font-label-md text-on-surface-variant block text-xs">Deep pattern inspection & anti-hallucination quote check</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAi}
                    onChange={(e) => setIncludeAi(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                </label>
              </div>
            </div>
          )}

          {/* Tab Content: Screenshots / File Upload */}
          {activeTab === 'screenshots' && (
            <div className="space-y-space-md" id="content-screenshots">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-space-lg text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                  dragActive
                    ? 'border-primary bg-primary-fixed/20'
                    : 'border-outline-variant bg-surface-container-low/50 hover:bg-surface-container-low'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.html,.htm"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center mb-space-sm text-primary">
                  <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                </div>
                <p className="font-body-md font-medium text-on-surface mb-space-xs">
                  {uploadedFileName ? `Selected: ${uploadedFileName}` : 'Drag and drop your screenshot or HTML here'}
                </p>
                <p className="font-body-sm text-on-surface-variant mb-space-md text-xs">
                  Supports PNG, JPG, WEBP, or HTML files up to 15MB
                </p>
                <button
                  type="button"
                  className="px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface font-label-md shadow-sm border border-outline-variant/40 hover:bg-surface-container transition-all text-xs font-semibold"
                >
                  {uploadedFileName ? 'Choose another file' : 'Choose files'}
                </button>
              </div>

              {/* AI analysis toggle for screenshots */}
              <div className="flex items-center justify-between py-space-xs">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    smart_toy
                  </span>
                  <div>
                    <span className="font-body-md font-medium text-on-surface block">AI vision inspection</span>
                    <span className="font-label-md text-on-surface-variant block text-xs">Analyze visual emphasis & layout asymmetry</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAi}
                    onChange={(e) => setIncludeAi(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                </label>
              </div>
            </div>
          )}

          {/* Tab Content: Sample Pages */}
          {activeTab === 'samples' && (
            <div className="space-y-space-sm max-h-72 overflow-y-auto pr-1" id="content-samples">
              {corpusList.length > 0 ? (
                corpusList.map((item) => {
                  const isSelected = selectedCorpusId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSample(item.id)}
                      className={`p-space-md rounded-lg cursor-pointer transition-all flex items-center justify-between group border ${
                        isSelected
                          ? 'bg-primary-fixed/20 border-primary-container shadow-sm'
                          : 'bg-surface-container-low hover:bg-surface-container border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-space-md">
                        <span className="material-symbols-outlined text-primary text-[20px]">
                          {getCorpusIcon(item.category)}
                        </span>
                        <div>
                          <h4 className="font-body-md font-medium text-on-surface group-hover:text-primary transition-colors text-sm">
                            {item.notes || item.id}
                          </h4>
                          <p className="font-body-sm text-on-surface-variant text-xs">
                            {item.patterns.length > 0
                              ? `Deceptive: ${item.patterns.join(', ')}`
                              : 'Clean fair design control (negative example)'}
                          </p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-outline text-[18px]">
                        {isSelected ? 'check_circle' : 'chevron_right'}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-on-surface-variant text-sm">
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
              className={`w-full h-12 bg-primary-container text-on-primary-container rounded-lg font-headline-sm flex items-center justify-center gap-space-sm shadow-sm transition-all text-base font-semibold ${
                isLoading || (activeTab === 'screenshots' && !uploadedContent) || (activeTab === 'url' && !url.trim())
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:opacity-95 cursor-pointer active:scale-[0.99]'
              }`}
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  <span>Analysing patterns...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">radar</span>
                  <span>Analyse page</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Privacy Note */}
        <div className="mt-space-md flex items-center justify-center gap-space-xs text-center">
          <span className="material-symbols-outlined text-outline text-[14px]">lock</span>
          <p className="font-label-md text-on-surface-variant text-xs">
            Pages are analysed in your browser session and not permanently stored.
          </p>
        </div>
      </div>

      {/* Focus Cards Section: Common Deceptive Patterns */}
      <div className="mb-space-md">
        <h3 className="font-headline-sm text-on-surface mb-space-sm font-semibold text-lg">
          Common deceptive patterns
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
        <div
          onClick={() => onCategoryFilter?.('hidden_charges')}
          className="bg-surface-container-lowest rounded-xl p-space-md shadow-[0px_1px_3px_rgba(15,23,42,0.04)] border border-outline-variant/30 flex items-center gap-space-md cursor-pointer hover:border-outline-variant transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">payments</span>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-body-md font-semibold text-on-surface text-sm">Hidden charges</h4>
            <p className="font-body-sm text-on-surface-variant text-xs truncate">Mandatory fees added at checkout</p>
          </div>
        </div>

        <div
          onClick={() => onCategoryFilter?.('cancellation')}
          className="bg-surface-container-lowest rounded-xl p-space-md shadow-[0px_1px_3px_rgba(15,23,42,0.04)] border border-outline-variant/30 flex items-center gap-space-md cursor-pointer hover:border-outline-variant transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">block</span>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-body-md font-semibold text-on-surface text-sm">Cancellation</h4>
            <p className="font-body-sm text-on-surface-variant text-xs truncate">Concealed links or forced phone calls</p>
          </div>
        </div>

        <div
          onClick={() => onCategoryFilter?.('consent')}
          className="bg-surface-container-lowest rounded-xl p-space-md shadow-[0px_1px_3px_rgba(15,23,42,0.04)] border border-outline-variant/30 flex items-center gap-space-md cursor-pointer hover:border-outline-variant transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">rule</span>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-body-md font-semibold text-on-surface text-sm">Consent</h4>
            <p className="font-body-sm text-on-surface-variant text-xs truncate">Pre-ticked boxes for data sharing</p>
          </div>
        </div>
      </div>
    </div>
  );
};
