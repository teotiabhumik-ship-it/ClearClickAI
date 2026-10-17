import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  Ban,
  ShieldAlert,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { CorpusItem } from '../types';

interface SamplePagesCarouselProps {
  samples: CorpusItem[];
  onSelectSample: (corpusId: string) => void;
  isLoading: boolean;
}

export const SamplePagesCarousel: React.FC<SamplePagesCarouselProps> = ({
  samples,
  onSelectSample,
  isLoading,
}) => {
  const [startIndex, setStartIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<any>(null);

  // Filter or limit to a curated list of interesting sample pages
  const items = samples.length > 0 ? samples : [];
  // Number of visible cards at a time (3 on desktop, 2 on tablet, 1 on mobile)
  const visibleCount = 3;

  const nextSlide = () => {
    if (items.length <= 1) return;
    setStartIndex((prev) => (prev + 1) % items.length);
  };

  const prevSlide = () => {
    if (items.length <= 1) return;
    setStartIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  // Auto-advance carousel every 5.5 seconds unless user hovers
  useEffect(() => {
    if (isPaused || isLoading || items.length <= visibleCount) return;

    timerRef.current = setInterval(() => {
      setStartIndex((prev) => (prev + 1) % items.length);
    }, 5500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, isLoading, items.length]);

  if (items.length === 0) return null;

  // Get current window of items (wrap around seamlessly)
  const visibleItems = [];
  for (let i = 0; i < visibleCount; i++) {
    const item = items[(startIndex + i) % items.length];
    if (item) visibleItems.push(item);
  }

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'hidden_charges':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-red-tint text-red-pen border border-red-pen/30">
            <CreditCard className="w-3 h-3" />
            <span>Hidden charges</span>
          </span>
        );
      case 'cancellation':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <Ban className="w-3 h-3" />
            <span>Cancellation hurdle</span>
          </span>
        );
      case 'consent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
            <ShieldAlert className="w-3 h-3" />
            <span>Consent asymmetry</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-paper dark:bg-[#0B1220] text-ink-muted border border-border-hairline dark:border-[#26324A]">
            <Search className="w-3 h-3" />
            <span>Control fixture</span>
          </span>
        );
    }
  };

  return (
    <div
      className="mb-8 select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header and Controls */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-ink dark:text-[#2DD4BF]" aria-hidden="true" />
          <span className="font-mono text-xs uppercase tracking-wider font-semibold text-ink-muted dark:text-[#94A3B8]">
            Instant Demonstration · Sample Pages
          </span>
          <span className="hidden sm:inline-block text-xs text-ink-muted/70 dark:text-[#94A3B8]/70 font-mono">
            ({startIndex + 1}-{Math.min(startIndex + visibleCount, items.length)} of {items.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={prevSlide}
            disabled={isLoading}
            className="p-1.5 rounded-sm bg-white dark:bg-[#111A2E] border border-border-hairline dark:border-[#26324A] text-ink-muted hover:text-ink dark:hover:text-[#E2E8F0] shadow-sm transition-all disabled:opacity-40"
            title="Previous sample page"
            aria-label="Previous sample page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            disabled={isLoading}
            className="p-1.5 rounded-sm bg-white dark:bg-[#111A2E] border border-border-hairline dark:border-[#26324A] text-ink-muted hover:text-ink dark:hover:text-[#E2E8F0] shadow-sm transition-all disabled:opacity-40"
            title="Next sample page"
            aria-label="Next sample page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Carousel Track with Glass Blur Fade Edges */}
      <div className="relative overflow-hidden p-1">
        {/* Left Blur Glass Fade Mask */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-12 z-10 bg-gradient-to-r from-paper via-paper/70 dark:from-[#0B1220] dark:via-[#0B1220]/70 to-transparent backdrop-blur-[2px] transition-opacity"
        />

        {/* Right Blur Glass Fade Mask */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-12 z-10 bg-gradient-to-l from-paper via-paper/70 dark:from-[#0B1220] dark:via-[#0B1220]/70 to-transparent backdrop-blur-[2px] transition-opacity"
        />

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {visibleItems.map((item, idx) => (
            <div
              key={`${item.id}-${startIndex}-${idx}`}
              onClick={() => !isLoading && onSelectSample(item.id)}
              className={`backdrop-blur-md bg-white/80 dark:bg-[#111A2E]/80 border border-border-hairline dark:border-[#26324A] hover:border-ink dark:hover:border-[#2DD4BF] rounded-sm p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[145px] group ${
                isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  {getCategoryBadge(item.category)}
                  <span className="font-mono text-[10px] text-ink-muted dark:text-[#94A3B8] opacity-75">
                    Fixture #{item.id.slice(0, 14)}
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-ink dark:text-[#E2E8F0] group-hover:text-red-pen transition-colors line-clamp-2">
                  {item.notes || item.id}
                </h4>

                <p className="text-xs text-ink-muted dark:text-[#94A3B8] mt-1 line-clamp-2">
                  {item.patterns.length > 0 ? (
                    <span>Flagged patterns: {item.patterns.join(', ')}</span>
                  ) : (
                    <span>Clean ground-truth baseline control (negative control fixture)</span>
                  )}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border-hairline/60 dark:border-[#26324A]/60 flex items-center justify-between text-xs font-medium text-ink dark:text-[#2DD4BF] group-hover:translate-x-0.5 transition-transform">
                <span>Test this sample</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
