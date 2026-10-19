import React from 'react';
import { Camera, Loader2 } from 'lucide-react';

interface SkeletonBlockProps {
  className?: string;
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ className = '' }) => (
  <span aria-hidden="true" className={`skeleton-shimmer block rounded-sm ${className}`} />
);

export const AnalysisLoadingSkeleton: React.FC = () => (
  <section
    aria-busy="true"
    aria-label="Preparing page analysis"
    className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-10 gap-8 items-start animate-fadeIn"
  >
    <span className="sr-only" role="status">
      Preparing the evidence workspace. The page is being inspected.
    </span>
    <div className="lg:col-span-6 space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="h-3 w-20" />
      </div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-sm border border-border-hairline bg-white p-5">
        <div className="flex items-center justify-between border-b border-border-hairline pb-4">
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-3 w-24" />
        </div>
        <div className="mt-6 space-y-4">
          <SkeletonBlock className="h-8 w-3/5" />
          <SkeletonBlock className="h-3 w-4/5" />
          <div className="grid grid-cols-3 gap-3 pt-4">
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
          </div>
          <SkeletonBlock className="h-24 w-full" />
        </div>
        <div className="absolute left-[42%] top-[48%] h-7 w-7 rounded-full border-2 border-red-pen/40 bg-red-pen/10" />
      </div>
      <div className="flex items-center gap-2 text-xs font-mono text-ink-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-red-pen animate-pulse" aria-hidden="true" />
        Reading DOM structure, styles, and visible evidence…
      </div>
    </div>
    <div className="lg:col-span-4 space-y-4">
      <div className="border border-border-hairline bg-white rounded-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-5 w-16" />
        </div>
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-11/12" />
        <div className="space-y-2 border border-border-hairline bg-paper p-3">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-4/5" />
          <SkeletonBlock className="h-3 w-10/12" />
        </div>
        <SkeletonBlock className="h-3 w-32" />
      </div>
      <div className="border border-dashed border-border-hairline p-4 rounded-sm space-y-2">
        <SkeletonBlock className="h-3 w-36" />
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-4/5" />
      </div>
    </div>
  </section>
);

export const SiteScanStartingSkeleton: React.FC = () => (
  <section
    aria-busy="true"
    aria-label="Starting site scan"
    className="w-full max-w-5xl mx-auto mb-8 rounded-sm border border-border-hairline bg-white p-6 space-y-6 animate-fadeIn"
  >
    <span className="sr-only" role="status">
      Starting the site scan and discovering prioritized pages.
    </span>
    <div className="flex items-start justify-between gap-4 border-b border-border-hairline pb-5">
      <div className="space-y-3 flex-1">
        <SkeletonBlock className="h-3 w-44" />
        <SkeletonBlock className="h-6 w-3/5" />
        <SkeletonBlock className="h-3 w-4/5" />
      </div>
      <SkeletonBlock className="h-10 w-28 shrink-0" />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((item) => <SkeletonBlock key={item} className="h-16" />)}
    </div>
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonBlock className="h-3 w-28" />
      </div>
      {[1, 2, 3].map((item) => <SkeletonBlock key={item} className="h-12 w-full" />)}
    </div>
  </section>
);

export const ScreenshotLoadingSkeleton: React.FC<{ url?: string }> = ({ url }) => (
  <div
    role="status"
    aria-live="polite"
    aria-label="Loading page screenshot"
    className="relative w-full min-h-[580px] bg-white rounded-sm border border-border-hairline overflow-hidden p-6 flex flex-col justify-between select-none animate-fadeIn"
  >
    {/* Background Shimmer Page Layout Structure */}
    <div className="space-y-6 opacity-40 pointer-events-none">
      {/* Mock Header Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-border-hairline">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-6 w-28 rounded-md" />
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-3 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-7 w-20 rounded" />
          <SkeletonBlock className="h-7 w-24 rounded" />
        </div>
      </div>

      {/* Hero Section Wireframe */}
      <div className="grid grid-cols-12 gap-6 items-center py-4">
        <div className="col-span-7 space-y-4">
          <SkeletonBlock className="h-8 w-4/5 rounded-md" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-3/4" />
          <div className="flex gap-3 pt-2">
            <SkeletonBlock className="h-9 w-32 rounded-lg" />
            <SkeletonBlock className="h-9 w-28 rounded-lg" />
          </div>
        </div>
        <div className="col-span-5">
          <SkeletonBlock className="h-44 w-full rounded-lg" />
        </div>
      </div>

      {/* Pricing / Feature Cards Wireframe */}
      <div className="grid grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-lg border border-border-hairline space-y-3 bg-stone-50/50">
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-7 w-24" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-4/5" />
          <SkeletonBlock className="h-8 w-full rounded mt-4" />
        </div>
        <div className="p-4 rounded-lg border-2 border-amber-300 space-y-3 bg-amber-50/30">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-7 w-28" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-5/6" />
          <SkeletonBlock className="h-8 w-full rounded mt-4" />
        </div>
        <div className="p-4 rounded-lg border border-border-hairline space-y-3 bg-stone-50/50">
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-7 w-24" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-3/4" />
          <SkeletonBlock className="h-8 w-full rounded mt-4" />
        </div>
      </div>
    </div>

    {/* Central Floating Custom Status Card */}
    <div className="absolute inset-0 flex items-center justify-center p-4 bg-white/70 backdrop-blur-[2px]">
      <div className="bg-white/95 rounded-2xl p-6 max-w-sm w-full border border-outline-variant/70 shadow-[0_8px_30px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        <div className="relative mb-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shadow-inner">
            <Camera className="w-6 h-6 animate-pulse" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
          </span>
        </div>

        <h4 className="text-sm font-bold text-ink mb-1 font-serif">
          Rendering Visual Evidence
        </h4>
        <p className="text-xs text-ink-muted mb-4 max-w-xs leading-relaxed font-sans">
          Optimizing full-page screenshot and aligning proof markers...
        </p>

        {/* Live scanning progress bar indicator */}
        <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-amber-500 rounded-full w-2/3 animate-[shimmer_1.5s_infinite_linear] bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-stone-500 truncate max-w-full">
          <Loader2 className="w-3 h-3 animate-spin shrink-0 text-amber-700" />
          <span className="truncate">{url || 'Loading target page...'}</span>
        </div>
      </div>
    </div>
  </div>
);
