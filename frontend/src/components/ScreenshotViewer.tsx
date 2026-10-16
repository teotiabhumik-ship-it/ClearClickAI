import React, { useState, useRef, useEffect } from 'react';
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
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalDims, setNaturalDims] = useState<{ width: number; height: number }>({ width: 1280, height: 800 });

  // Update natural dimensions when image changes or completes loading
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth) {
      setNaturalDims({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      });
    }
  }, [screenshotBase64]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const nw = e.currentTarget.naturalWidth;
    const nh = e.currentTarget.naturalHeight;
    if (nw && nh) {
      setNaturalDims({ width: nw, height: nh });
    }
  };

  // Filter findings that have non-zero bounding box
  const visualFindings = findings.map((f, i) => ({ ...f, originalIndex: i }))
    .filter(f => f.bbox && f.bbox.length === 4 && f.bbox[2] > 0 && f.bbox[3] > 0);

  const getSeverityColor = (sev: string, isSelected: boolean) => {
    if (isSelected) return '#0f766e'; // Primary Teal when selected
    switch (sev) {
      case 'high': return '#b91c1c'; // Serious Red
      case 'medium': return '#b45309'; // Caution Amber
      case 'low': return '#1d4ed8'; // Notice Blue
      default: return '#0f766e';
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden shadow-[0px_1px_3px_rgba(15,23,42,0.04)] flex flex-col h-full min-h-[540px]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low border-b border-outline-variant/30">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">visibility</span>
          <span className="text-xs font-semibold text-on-surface uppercase tracking-wider">
            Evidence Viewport (Captured Page)
          </span>
          <span className="bg-surface-container text-on-surface-variant text-[11px] px-2.5 py-0.5 rounded-full font-mono font-medium">
            {visualFindings.length} Highlight{visualFindings.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom(prev => Math.max(0.6, prev - 0.15))}
            className="p-1 text-on-surface-variant hover:text-on-surface bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/30 rounded transition-colors shadow-2xs"
            title="Zoom out"
          >
            <span className="material-symbols-outlined text-[16px] block">zoom_out</span>
          </button>
          <span className="text-xs text-on-surface-variant font-mono w-12 text-center font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(prev => Math.min(2.0, prev + 0.15))}
            className="p-1 text-on-surface-variant hover:text-on-surface bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/30 rounded transition-colors shadow-2xs"
            title="Zoom in"
          >
            <span className="material-symbols-outlined text-[16px] block">zoom_in</span>
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1 text-on-surface-variant hover:text-on-surface bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/30 rounded transition-colors ml-1 shadow-2xs"
            title="Reset Zoom"
          >
            <span className="material-symbols-outlined text-[16px] block">fit_screen</span>
          </button>
        </div>
      </div>

      {/* Viewport Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-surface-container/40 p-4 relative flex items-start justify-center"
      >
        {screenshotBase64 ? (
          <div
            className="relative transition-transform duration-150 origin-top shadow-md rounded border border-outline-variant/40 bg-white"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              ref={imgRef}
              src={`data:image/png;base64,${screenshotBase64}`}
              alt="Page Screenshot"
              className="max-w-none block select-none rounded"
              style={{ width: '100%', maxWidth: '1000px' }}
              onLoad={handleImageLoad}
            />

            {/* SVG Interactive Overlay with pixel-perfect viewBox scaling */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-auto rounded"
              viewBox={`0 0 ${naturalDims.width} ${naturalDims.height}`}
              preserveAspectRatio="none"
              style={{ overflow: 'visible' }}
            >
              {visualFindings.map((f) => {
                const isSelected = selectedFindingIndex === f.originalIndex;
                const isHovered = hoveredIdx === f.originalIndex;
                const strokeColor = getSeverityColor(f.severity, isSelected);
                const [x, y, w, h] = f.bbox;
                const badgeY = y > 24 ? y - 6 : y + h + 22;

                return (
                  <g
                    key={f.originalIndex}
                    onClick={() => onSelectFinding(f.originalIndex)}
                    onMouseEnter={() => setHoveredIdx(f.originalIndex)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer transition-all"
                  >
                    {/* Bounding box rectangle */}
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={isSelected || isHovered ? `${strokeColor}33` : `${strokeColor}18`}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3.5 : 2}
                      strokeDasharray={isSelected ? 'none' : '4 2'}
                      vectorEffect="non-scaling-stroke"
                      rx={3}
                      className="transition-all"
                    />

                    {/* Tag badge above/below bbox */}
                    <g transform={`translate(${x}, ${badgeY})`}>
                      <rect
                        x={0}
                        y={-18}
                        width={Math.max(70, f.type.length * 8 + 18)}
                        height={22}
                        fill={strokeColor}
                        rx={4}
                      />
                      <text
                        x={8}
                        y={-3}
                        fill="#ffffff"
                        fontSize="13"
                        fontWeight="bold"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
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
          <div className="flex flex-col items-center justify-center h-72 text-center p-6 text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] text-outline mb-3">image_not_supported</span>
            <p className="text-sm font-semibold text-on-surface">No screenshot preview available</p>
            <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
              Analyse a live URL or corpus fixture to inspect the rendered page elements and bounding box highlights.
            </p>
          </div>
        )}
      </div>

      {/* Legend bar */}
      <div className="px-4 py-2.5 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between text-xs text-on-surface-variant">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#b91c1c]" />
            <span className="font-medium text-[11px]">Serious</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#b45309]" />
            <span className="font-medium text-[11px]">Caution</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1d4ed8]" />
            <span className="font-medium text-[11px]">Notice</span>
          </span>
        </div>
        <span className="text-[11px] text-on-surface-variant italic hidden sm:inline">
          Click highlighted box to focus finding
        </span>
      </div>
    </div>
  );
};
