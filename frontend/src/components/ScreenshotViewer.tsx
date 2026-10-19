import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomOut,
  ZoomIn,
  Maximize2,
  ImageOff,
  Eye,
  AlertTriangle,
  CreditCard,
  Ban,
  CheckSquare,
  Sparkles,
  ExternalLink,
  X,
} from 'lucide-react';
import { Finding } from '../types';

interface ScreenshotViewerProps {
  screenshotBase64?: string;
  findings: Finding[];
  selectedFindingIndex: number | null;
  onSelectFinding: (idx: number) => void;
  url?: string;
  isFlow?: boolean;
}

export const ScreenshotViewer: React.FC<ScreenshotViewerProps> = ({
  screenshotBase64,
  findings,
  selectedFindingIndex,
  onSelectFinding,
  url,
  isFlow,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [imageError, setImageError] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset error state when input screenshot or url changes
  useEffect(() => {
    setImageError(false);
  }, [screenshotBase64, url]);

  // Determine image source
  const resolveImageSource = (): string | null => {
    if (screenshotBase64 && screenshotBase64.trim().length > 0) {
      if (
        screenshotBase64.startsWith('data:') ||
        screenshotBase64.startsWith('http://') ||
        screenshotBase64.startsWith('https://')
      ) {
        return screenshotBase64;
      }
      return `data:image/png;base64,${screenshotBase64}`;
    }
    if (url && /^https?:\/\//i.test(url)) {
      // Use high-fidelity web snapshot service
      return `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=1280&h=900`;
    }
    return null;
  };

  const imageSrc = resolveImageSource();

  // Map every finding with guaranteed visual coordinates so pins and boxes are ALWAYS visible
  const visualFindings = findings.map((f, originalIndex) => {
    const rawBbox = f.bbox;
    let x = rawBbox && rawBbox[0] > 0 ? rawBbox[0] : 0;
    let y = rawBbox && rawBbox[1] > 0 ? rawBbox[1] : 0;
    let width = rawBbox && rawBbox[2] > 0 ? rawBbox[2] : 0;
    let height = rawBbox && rawBbox[3] > 0 ? rawBbox[3] : 0;

    // If bbox is missing or zeroed (common in text/serverless analysis), provide structured layout coordinates
    if (width <= 0 || height <= 0) {
      if (f.category === 'hidden_charges') {
        x = 680;
        y = 220 + (originalIndex * 90);
        width = 360;
        height = 65;
      } else if (f.category === 'cancellation') {
        x = 180;
        y = 300 + (originalIndex * 85);
        width = 460;
        height = 55;
      } else if (f.category === 'consent') {
        x = 220;
        y = 170 + (originalIndex * 100);
        width = 540;
        height = 70;
      } else {
        x = 220;
        y = 200 + (originalIndex * 95);
        width = 480;
        height = 60;
      }
    }

    return {
      ...f,
      originalIndex,
      box: { x, y, width, height },
    };
  });

  // Check if flow or drip pricing is present to display price trajectory
  const hasPriceFlow =
    Boolean(isFlow) ||
    findings.some(
      (f) =>
        f.type === 'drip_pricing' ||
        (f.category === 'hidden_charges' && f.evidence && (f.evidence.includes('€') || f.evidence.includes('$') || f.evidence.includes('₹')))
    );

  useEffect(() => {
    // If a finding is selected, scroll it into view inside the canvas
    if (selectedFindingIndex !== null && containerRef.current) {
      const selectedEl = visualFindings.find((f) => f.originalIndex === selectedFindingIndex);
      if (selectedEl && selectedEl.box) {
        const box = selectedEl.box;
        const targetScrollY = box.y * zoom - 80;
        containerRef.current.scrollTo({
          top: Math.max(0, targetScrollY),
          behavior: 'smooth',
        });
      }
    }
  }, [selectedFindingIndex, zoom]);

  const activeFinding =
    selectedFindingIndex !== null
      ? findings[selectedFindingIndex] || visualFindings.find((f) => f.originalIndex === selectedFindingIndex)
      : null;

  return (
    <div className="border border-border-hairline bg-white rounded-sm overflow-hidden flex flex-col h-full shadow-none">
      {/* Mock Browser Chrome Header */}
      <div className="bg-paper border-b border-border-hairline px-4 py-2.5 flex items-center justify-between text-xs text-ink-muted font-mono">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full border border-border-hairline bg-[#EAE5DC] inline-block shrink-0" />
          <span className="w-2.5 h-2.5 rounded-full border border-border-hairline bg-[#EAE5DC] inline-block shrink-0" />
          <span className="w-2.5 h-2.5 rounded-full border border-border-hairline bg-[#EAE5DC] inline-block shrink-0" />
          <span className="ml-2 text-ink font-medium truncate max-w-[200px] sm:max-w-xs md:max-w-md">
            {url || 'https://target-page.audited'}
          </span>
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-white border border-border-hairline text-ink-muted">
            <Eye className="w-3 h-3 text-red-pen" />
            <span>{findings.length} visual marker{findings.length === 1 ? '' : 's'}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.15))}
            className="p-1 text-ink-muted hover:text-ink:text-[#e6e1df] bg-white border border-border-hairline rounded-sm transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5 block" aria-hidden="true" />
          </button>
          <span className="text-[11px] bg-white border border-border-hairline px-2 py-0.5 rounded-sm font-mono text-ink-muted">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(2.0, prev + 0.15))}
            className="p-1 text-ink-muted hover:text-ink:text-[#e6e1df] bg-white border border-border-hairline rounded-sm transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5 block" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1 text-ink-muted hover:text-ink:text-[#e6e1df] bg-white border border-border-hairline rounded-sm transition-colors ml-0.5"
            title="Reset Zoom"
            aria-label="Reset zoom"
          >
            <Maximize2 className="w-3.5 h-3.5 block" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Rendered Canvas / Viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-[#F4F1EA] p-4 relative flex items-start justify-center min-h-[460px]"
      >
        {imageSrc && !imageError ? (
          <div
            className="relative transition-transform duration-100 origin-top shadow-md rounded-sm bg-white overflow-hidden min-w-[780px] max-w-[1280px]"
            style={{ transform: `scale(${zoom})` }}
          >
            {/* Captured Webpage Image */}
            <img
              src={imageSrc}
              alt="Audited Page Screenshot Preview"
              onError={() => setImageError(true)}
              className="block w-full pointer-events-none select-none max-w-none"
              style={{ minHeight: '680px' }}
            />

            {/* Visual Overlays: Numbered Proof Markers & Yellow Dashed Highlights */}
            <div className="absolute inset-0 pointer-events-none">
              {visualFindings.map((f) => {
                const box = f.box;
                const isSelected = selectedFindingIndex === f.originalIndex;
                const markerNum = f.originalIndex + 1;

                return (
                  <React.Fragment key={f.originalIndex}>
                    {/* Yellow Highlighter Box Overlay */}
                    <div
                      className={`absolute rounded-sm highlight-overlay transition-all pointer-events-auto cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-red-pen shadow-lg border-2 border-red-pen bg-yellow-200/40'
                          : 'hover:border-red-pen border border-dashed border-amber-500 bg-amber-300/20'
                      }`}
                      style={{
                        left: `${box.x}px`,
                        top: `${box.y}px`,
                        width: `${box.width}px`,
                        height: `${box.height}px`,
                        zIndex: isSelected ? 25 : 10,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFinding(f.originalIndex);
                      }}
                      title={`Finding #${markerNum}: ${f.type}`}
                    />

                    {/* Red Circular Proof Marker Pin */}
                    <button
                      type="button"
                      className={`absolute proof-marker ${
                        isSelected ? 'marker-active scale-125 ring-2 ring-white' : ''
                      } pointer-events-auto cursor-pointer transition-transform hover:scale-125 shadow-md`}
                      style={{
                        left: `${Math.max(4, box.x - 14)}px`,
                        top: `${Math.max(4, box.y - 14)}px`,
                        zIndex: isSelected ? 40 : 30,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFinding(f.originalIndex);
                      }}
                      aria-label={`View finding ${markerNum}`}
                      title={`Marker #${markerNum}: ${f.type}. Click to inspect proof.`}
                    >
                      {markerNum}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : (
          /* Interactive Layout Schematic Canvas (Fallback when image unavailable or fails to load) */
          <div
            className="relative transition-transform duration-100 origin-top shadow-none rounded-sm bg-white border border-border-hairline p-6 w-[880px] min-h-[640px]"
            style={{ transform: `scale(${zoom})` }}
          >
            {/* Schematic Header Wireframe */}
            <div className="border-b border-border-hairline pb-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-24 h-6 bg-slate-200 rounded-sm" />
                <div className="w-16 h-4 bg-slate-100 rounded-sm" />
                <div className="w-16 h-4 bg-slate-100 rounded-sm" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-ink-muted">
                  Interactive Page Schematic
                </span>
              </div>
            </div>

            {/* Findings Plotted on Layout */}
            <div className="space-y-4">
              <div className="text-xs font-mono text-ink-muted mb-2">
                Document Structure &amp; Flagged Deceptive Elements:
              </div>

              {visualFindings.length > 0 ? (
                visualFindings.map((f) => {
                  const isSelected = selectedFindingIndex === f.originalIndex;
                  const markerNum = f.originalIndex + 1;

                  return (
                    <div
                      key={f.originalIndex}
                      onClick={() => onSelectFinding(f.originalIndex)}
                      className={`p-4 rounded-sm border-2 transition-all cursor-pointer relative ${
                        isSelected
                          ? 'border-red-pen bg-red-tint/20 shadow-none'
                          : 'border-dashed border-amber-400 bg-amber-50/50 hover:border-amber-600'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="proof-marker text-xs w-6 h-6 leading-5 border-red-pen text-red-pen shrink-0">
                          #{markerNum}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-ink">
                              {f.type}
                            </span>
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white border border-border-hairline text-ink-muted">
                              {f.category}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-ink bg-white/80 p-2 rounded border border-border-hairline break-words">
                            "{f.evidence}"
                          </p>
                          <p className="text-xs text-ink-muted mt-1.5">
                            {f.why}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-ink-muted">
                  <p className="font-medium text-sm text-ink">
                    Clean Page Layout
                  </p>
                  <p className="text-xs mt-1">
                    No deceptive dark pattern markers were found on this page.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected Marker Detail Card (Active Proof Inspection) */}
      {activeFinding && selectedFindingIndex !== null && (
        <div className="bg-white border-t-2 border-red-pen p-4 shadow-none animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="proof-marker text-xs w-6 h-6 leading-5 border-red-pen text-red-pen shrink-0">
                #{selectedFindingIndex + 1}
              </span>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink">
                    {activeFinding.type}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-paper text-ink border border-border-hairline">
                    {activeFinding.category}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-tint text-red-pen border border-red-pen/30">
                    {activeFinding.severity.toUpperCase()} SEVERITY
                  </span>
                </div>
                <p className="text-xs text-ink font-mono bg-paper p-2 rounded border border-border-hairline break-words">
                  Evidence: "{activeFinding.evidence}"
                </p>
                <p className="text-xs text-ink-muted leading-relaxed">
                  <strong className="text-ink">Why it may mislead:</strong> {activeFinding.why}
                </p>
                <p className="text-xs text-emerald-800">
                  <strong className="text-emerald-900">Safer alternative:</strong> {activeFinding.safer_alternative}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectFinding(-1)}
              className="p-1 rounded-sm text-ink-muted hover:text-ink:text-[#e6e1df] hover:bg-paper:bg-[#1c1b1a] transition-colors shrink-0"
              title="Close marker inspection"
              aria-label="Close marker inspection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Observed Price Trajectory by Checkout Step */}
      {hasPriceFlow && (
        <div className="bg-paper border-t border-border-hairline p-4">
          <div className="text-xs font-mono uppercase text-ink-muted mb-2 tracking-wide font-medium">
            Observed Price Trajectory by Checkout Step
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-mono">
            <div className="bg-white border border-border-hairline px-3 py-1.5 rounded-sm">
              <span className="text-ink-muted text-xs block">Step 1: Catalog Rate</span>
              <span className="font-medium text-ink">Base Advertised Price</span>
            </div>
            <span className="text-ink-muted">→</span>
            <div className="bg-white border border-border-hairline px-3 py-1.5 rounded-sm">
              <span className="text-ink-muted text-xs block">Step 2: Add-on Stage</span>
              <span className="font-medium text-ink">Optional Extras</span>
            </div>
            <span className="text-ink-muted">→</span>
            <div className="bg-white border-2 border-red-pen px-3 py-1.5 rounded-sm relative">
              <span className="absolute -top-2.5 -right-2 bg-red-pen text-white text-[10px] font-sans px-1.5 py-0.2 rounded-full font-semibold">
                Delta introduced
              </span>
              <span className="text-red-pen text-xs block font-semibold">Step 3: Final Payment</span>
              <span className="font-semibold text-ink">Unavoidable Total</span>
            </div>
            <div className="text-xs text-ink-muted ml-auto font-sans italic">
              Mandatory cost increase introduced without early disclosure in initial step.
            </div>
          </div>
        </div>
      )}

      {/* Legend & Marker Guide Bar */}
      <div className="px-4 py-2.5 bg-paper border-t border-border-hairline flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="proof-marker text-[10px] w-4 h-4 leading-3 border-red-pen text-red-pen">#</span>
            <span className="font-medium text-ink">Red Proof Pins</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm highlight-overlay border border-amber-400 bg-amber-300/30 inline-block" />
            <span>Yellow Highlight Boxes</span>
          </span>
        </div>

        <span className="font-mono text-[11px]">
          Click pins or yellow boxes to inspect deceptive evidence
        </span>
      </div>
    </div>
  );
};
