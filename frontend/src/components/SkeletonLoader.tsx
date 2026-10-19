import React from 'react';

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
