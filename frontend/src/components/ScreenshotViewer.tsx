import React, { useState, useRef, useEffect } from 'react';
import { ZoomOut, ZoomIn, Maximize2, ImageOff } from 'lucide-react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter findings that have valid visual bounding boxes
  const visualFindings = findings
    .map((f, originalIndex) => {
      const bbox = f.bbox || [0, 0, 0, 0];
      return {
        ...f,
        originalIndex,
        box: { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] },
      };
    })
    .filter((f) => f.box.width > 0 && f.box.height > 0);

  // Check if flow or drip pricing is present to display price trajectory
  const hasPriceFlow =
    Boolean(isFlow) ||
    findings.some(
      (f) =>
        f.type === 'drip_pricing' ||
        (f.category === 'hidden_charges' && f.evidence && f.evidence.includes('€'))
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

  return (
    <div className="border border-border-hairline dark:border-[#26324A] bg-white dark:bg-[#111A2E] rounded-sm overflow-hidden flex flex-col h-full shadow-sm">
      {/* Mock Browser Chrome Header */}
      <div className="bg-paper dark:bg-[#0B1220] border-b border-border-hairline dark:border-[#26324A] px-4 py-2.5 flex items-center justify-between text-xs text-ink-muted dark:text-[#94A3B8] font-mono">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full border border-border-hairline dark:border-[#26324A] bg-[#EAE5DC] dark:bg-[#26324A] inline-block shrink-0" />
          <span className="w-2.5 h-2.5 rounded-full border border-border-hairline dark:border-[#26324A] bg-[#EAE5DC] dark:bg-[#26324A] inline-block shrink-0" />
          <span className="w-2.5 h-2.5 rounded-full border border-border-hairline dark:border-[#26324A] bg-[#EAE5DC] dark:bg-[#26324A] inline-block shrink-0" />
          <span className="ml-2 text-ink dark:text-[#E2E8F0] font-medium truncate max-w-[200px] sm:max-w-xs md:max-w-md">
            {url || 'https://captured-target-page.local'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.15))}
            className="p-1 text-ink-muted dark:text-[#94A3B8] hover:text-ink dark:hover:text-[#E2E8F0] bg-white dark:bg-[#111A2E] border border-border-hairline dark:border-[#26324A] rounded-sm transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5 block" aria-hidden="true" />
          </button>
          <span className="text-[11px] bg-white dark:bg-[#111A2E] border border-border-hairline dark:border-[#26324A] px-2 py-0.5 rounded-sm font-mono text-ink-muted dark:text-[#94A3B8]">
            {Math.round(zoom * 100)}% Canvas
          </span>
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(2.0, prev + 0.15))}
            className="p-1 text-ink-muted dark:text-[#94A3B8] hover:text-ink dark:hover:text-[#E2E8F0] bg-white dark:bg-[#111A2E] border border-border-hairline dark:border-[#26324A] rounded-sm transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5 block" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1 text-ink-muted dark:text-[#94A3B8] hover:text-ink dark:hover:text-[#E2E8F0] bg-white dark:bg-[#111A2E] border border-border-hairline dark:border-[#26324A] rounded-sm transition-colors ml-0.5"
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
        className="flex-1 overflow-auto bg-[#F4F1EA] dark:bg-[#0B1220]/70 p-4 relative flex items-start justify-center min-h-[460px]"
      >
        {screenshotBase64 ? (
          <div
            className="relative transition-transform duration-100 origin-top shadow-sm rounded-sm bg-white"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={`data:image/png;base64,${screenshotBase64}`}
              alt="Captured Page Proof"
              className="block max-w-none pointer-events-none select-none"
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
                        isSelected ? 'ring-2 ring-red-pen shadow-md' : 'hover:border-red-pen'
                      }`}
                      style={{
                        left: `${box.x}px`,
                        top: `${box.y}px`,
                        width: `${box.width}px`,
                        height: `${box.height}px`,
                        zIndex: isSelected ? 15 : 10,
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
                        isSelected ? 'marker-active' : ''
                      } pointer-events-auto cursor-pointer transition-transform hover:scale-110 shadow-sm`}
                      style={{
                        left: `${Math.max(0, box.x - 12)}px`,
                        top: `${Math.max(0, box.y - 12)}px`,
                        zIndex: isSelected ? 30 : 20,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFinding(f.originalIndex);
                      }}
                      aria-label={`View finding ${markerNum}`}
                      title={`Marker #${markerNum}: Click to inspect finding`}
                    >
                      {markerNum}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-72 text-center p-6 text-ink-muted dark:text-[#94A3B8]">
            <ImageOff className="w-12 h-12 text-border-hairline dark:text-[#26324A] mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink dark:text-[#E2E8F0]">No screenshot preview captured</p>
            <p className="text-sm text-ink-muted dark:text-[#94A3B8] mt-1 max-w-sm">
              Analyse a URL or sample page fixture to inspect the rendered page layout and numbered proof markers.
            </p>
          </div>
        )}
      </div>

      {/* Observed Price Trajectory by Checkout Step (shown when flow/drip pricing detected) */}
      {hasPriceFlow && (
        <div className="bg-paper dark:bg-[#0B1220] border-t border-border-hairline dark:border-[#26324A] p-4">
          <div className="text-xs font-mono uppercase text-ink-muted dark:text-[#94A3B8] mb-2 tracking-wide font-medium">
            Observed Price Trajectory by Checkout Step
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-mono">
            <div className="bg-white dark:bg-[#111A2E] border border-border-hairline dark:border-[#26324A] px-3 py-1.5 rounded-sm">
              <span className="text-ink-muted dark:text-[#94A3B8] text-xs block">Step 1: Catalog Rate</span>
              <span className="font-medium text-ink dark:text-[#E2E8F0]">Base Advertised Price</span>
            </div>
            <span className="text-ink-muted dark:text-[#94A3B8]">→</span>
            <div className="bg-white dark:bg-[#111A2E] border border-border-hairline dark:border-[#26324A] px-3 py-1.5 rounded-sm">
              <span className="text-ink-muted dark:text-[#94A3B8] text-xs block">Step 2: Add-on Stage</span>
              <span className="font-medium text-ink dark:text-[#E2E8F0]">Optional Extras</span>
            </div>
            <span className="text-ink-muted dark:text-[#94A3B8]">→</span>
            <div className="bg-white dark:bg-[#111A2E] border-2 border-red-pen px-3 py-1.5 rounded-sm relative">
              <span className="absolute -top-2.5 -right-2 bg-red-pen text-white text-[10px] font-sans px-1.5 py-0.2 rounded-full font-semibold">
                Delta introduced
              </span>
              <span className="text-red-pen text-xs block font-semibold">Step 3: Final Payment</span>
              <span className="font-semibold text-ink dark:text-white">Unavoidable Total</span>
            </div>
            <div className="text-xs text-ink-muted dark:text-[#94A3B8] ml-auto font-sans italic">
              Mandatory cost increase introduced without early disclosure in initial step.
            </div>
          </div>
        </div>
      )}

      {/* Legend & Marker Guide Bar */}
      <div className="px-4 py-2.5 bg-paper dark:bg-[#0B1220] border-t border-border-hairline dark:border-[#26324A] flex items-center justify-between text-xs text-ink-muted dark:text-[#94A3B8]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="proof-marker text-[10px] w-4 h-4 leading-3 border-red-pen text-red-pen">#</span>
            <span className="font-medium text-ink dark:text-[#E2E8F0]">Proof Marker Pin</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm highlight-overlay inline-block" />
            <span>Highlighter Overlay</span>
          </span>
        </div>

        <span className="font-mono text-[11px]">
          Click pins to jump to margin notes
        </span>
      </div>
    </div>
  );
};
