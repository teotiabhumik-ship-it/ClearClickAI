import React, { useState, useRef, useEffect } from 'react';
import { Eye, ZoomIn, ZoomOut, Maximize2, ShieldAlert } from 'lucide-react';
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
    if (isSelected) return '#ef4444'; // Red-500
    switch (sev) {
      case 'high': return '#f43f5e';
      case 'medium': return '#f59e0b';
      case 'low': return '#3b82f6';
      default: return '#eab308';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col h-full min-h-[500px]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Evidence Viewport (Captured Page)
          </span>
          <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-mono">
            {visualFindings.length} Bounding Box{visualFindings.length !== 1 ? 'es' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom(prev => Math.max(0.6, prev - 0.15))}
            className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-slate-400 font-mono w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(prev => Math.min(1.8, prev + 0.15))}
            className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors ml-1"
            title="Reset Zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Viewport Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-slate-950 p-4 relative flex items-start justify-center"
      >
        {screenshotBase64 ? (
          <div
            className="relative transition-transform duration-150 origin-top shadow-2xl rounded border border-slate-800"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              ref={imgRef}
              src={`data:image/png;base64,${screenshotBase64}`}
              alt="Page Screenshot"
              className="max-w-none block select-none"
              style={{ width: '100%', maxWidth: '1000px' }}
              onLoad={handleImageLoad}
            />

            {/* SVG Interactive Overlay for Bounding Boxes */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-auto"
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
                      fill={isSelected || isHovered ? `${strokeColor}33` : `${strokeColor}15`}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3 : 2}
                      strokeDasharray={isSelected ? 'none' : '4 2'}
                      vectorEffect="non-scaling-stroke"
                      rx={3}
                      className="transition-all"
                    />

                    {/* Tag badge above bbox */}
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
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-slate-500">
            <ShieldAlert className="w-12 h-12 mb-3 text-slate-600 stroke-[1.5]" />
            <p className="text-sm font-medium text-slate-400">No screenshot preview available</p>
            <p className="text-xs text-slate-600 mt-1">Run an analysis on any corpus fixture or live URL to inspect rendered elements.</p>
          </div>
        )}
      </div>

      {/* Legend bar */}
      <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>High Severity</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Medium Severity</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Low Severity</span>
          </span>
        </div>
        <span className="text-[11px] text-slate-500 italic">
          Click any highlighted box to focus finding
        </span>
      </div>
    </div>
  );
};
