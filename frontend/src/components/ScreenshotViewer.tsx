import React, { useState, useRef, useEffect } from 'react';
import { Eye, ZoomOut, ZoomIn, Maximize2, ImageOff } from 'lucide-react';
import { Finding } from '../types';

interface ScreenshotViewerProps {
  screenshotBase64?: string;
  findings: Finding[];
  selectedFindingIndex: number | null;
  onSelectFinding: (idx: number) => void;
}

export const ScreenshotViewer: React.FC<ScreenshotViewerProps> = ({
  screenshotBase64,
  findings,
  selectedFindingIndex,
  onSelectFinding,
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
        box: { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] }
      };
    })
    .filter(f => f.box.width > 0 && f.box.height > 0);

  useEffect(() => {
    // If a finding is selected, scroll it into view inside the canvas
    if (selectedFindingIndex !== null && containerRef.current) {
      const selectedEl = visualFindings.find(f => f.originalIndex === selectedFindingIndex);
      if (selectedEl && selectedEl.box) {
        const box = selectedEl.box;
        const targetScrollY = (box.y * zoom) - 80;
        containerRef.current.scrollTo({
          top: Math.max(0, targetScrollY),
          behavior: 'smooth'
        });
      }
    }
  }, [selectedFindingIndex, zoom]);

  const getFindingColor = (severity: string, isSelected: boolean) => {
    if (isSelected) return '#005c55'; // Selected brand primary
    switch (severity) {
      case 'high': return '#b91c1c'; // Serious Red
      case 'medium': return '#b45309'; // Caution Amber
      case 'low': return '#1d4ed8'; // Notice Blue
      default: return '#005c55';
    }
  };

  return (
    <div className="bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] rounded-xl overflow-hidden shadow-[0px_1px_3px_rgba(15,23,42,0.04)] flex flex-col h-full min-h-[540px]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low dark:bg-[#0B1220] border-b border-outline-variant/30 dark:border-[#26324A]">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary dark:text-[#2DD4BF]" aria-hidden="true" />
          <span className="text-sm font-semibold text-on-surface dark:text-[#E2E8F0] uppercase tracking-wider">
            Evidence Viewport (Captured Page)
          </span>
          <span className="bg-surface-container dark:bg-[#111A2E] text-on-surface-variant dark:text-[#94A3B8] text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
            {visualFindings.length} Highlight{visualFindings.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom(prev => Math.max(0.6, prev - 0.15))}
            className="p-1 text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0] bg-surface-container-lowest dark:bg-[#111A2E] hover:bg-surface-container border border-outline-variant/30 dark:border-[#26324A] rounded transition-colors shadow-2xs"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4 block" aria-hidden="true" />
          </button>
          <span className="text-xs text-on-surface-variant dark:text-[#94A3B8] font-mono w-12 text-center font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(prev => Math.min(2.0, prev + 0.15))}
            className="p-1 text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0] bg-surface-container-lowest dark:bg-[#111A2E] hover:bg-surface-container border border-outline-variant/30 dark:border-[#26324A] rounded transition-colors shadow-2xs"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4 block" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1 text-on-surface-variant dark:text-[#94A3B8] hover:text-on-surface dark:hover:text-[#E2E8F0] bg-surface-container-lowest dark:bg-[#111A2E] hover:bg-surface-container border border-outline-variant/30 dark:border-[#26324A] rounded transition-colors ml-1 shadow-2xs"
            title="Reset Zoom"
            aria-label="Reset zoom"
          >
            <Maximize2 className="w-4 h-4 block" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Viewport Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-surface-container/40 dark:bg-[#0B1220]/60 p-4 relative flex items-start justify-center"
      >
        {screenshotBase64 ? (
          <div
            className="relative transition-transform duration-100 origin-top shadow-md rounded-lg overflow-hidden bg-white"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={`data:image/png;base64,${screenshotBase64}`}
              alt="Page Preview"
              className="block max-w-none pointer-events-none select-none"
            />

            {/* Visual Highlight Bounding Boxes Overlay */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ overflow: 'visible' }}
            >
              {visualFindings.map((f) => {
                const box = f.box;
                const isSelected = selectedFindingIndex === f.originalIndex;
                const color = getFindingColor(f.severity, isSelected);

                return (
                  <g
                    key={f.originalIndex}
                    className="cursor-pointer pointer-events-auto transition-all"
                    onClick={() => onSelectFinding(f.originalIndex)}
                  >
                    {/* Pulsing selection halo */}
                    {isSelected && (
                      <rect
                        x={box.x - 3}
                        y={box.y - 3}
                        width={box.width + 6}
                        height={box.height + 6}
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        opacity="0.8"
                        rx="4"
                      />
                    )}

                    {/* Main highlight bounding outline */}
                    <rect
                      x={box.x}
                      y={box.y}
                      width={box.width}
                      height={box.height}
                      fill={isSelected ? `${color}25` : `${color}15`}
                      stroke={color}
                      strokeWidth={isSelected ? '3' : '2'}
                      rx="3"
                    />

                    {/* Badge identifier label on corner */}
                    <g transform={`translate(${box.x}, ${Math.max(0, box.y - 20)})`}>
                      <rect
                        x="0"
                        y="0"
                        width={Math.min(180, f.type.length * 7 + 16)}
                        height="18"
                        fill={color}
                        rx="3"
                      />
                      <text
                        x="6"
                        y="13"
                        fill="#ffffff"
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="600"
                      >
                        {f.type}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-72 text-center p-6 text-on-surface-variant dark:text-[#94A3B8]">
            <ImageOff className="w-12 h-12 text-outline dark:text-[#94A3B8] mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-on-surface dark:text-[#E2E8F0]">No screenshot preview available</p>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] mt-1 max-w-sm">
              Analyse a live URL or corpus fixture to inspect the rendered page elements and bounding box highlights.
            </p>
          </div>
        )}
      </div>

      {/* Legend bar */}
      <div className="px-4 py-2.5 bg-surface-container-low dark:bg-[#0B1220] border-t border-outline-variant/30 dark:border-[#26324A] flex items-center justify-between text-sm text-on-surface-variant dark:text-[#94A3B8]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B91C1C]" />
            <span className="font-medium text-xs">Serious</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B45309]" />
            <span className="font-medium text-xs">Caution</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1D4ED8]" />
            <span className="font-medium text-xs">Notice</span>
          </span>
        </div>

        <span className="text-xs font-mono text-outline dark:text-[#94A3B8]">
          Click boxes to jump to findings
        </span>
      </div>
    </div>
  );
};
