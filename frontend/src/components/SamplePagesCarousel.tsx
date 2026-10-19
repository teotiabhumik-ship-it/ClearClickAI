import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Flag,
  Check,
  Cookie,
  ShieldCheck,
  Ban,
  CreditCard,
  ShoppingBag,
} from 'lucide-react';

interface SamplePagesCarouselProps {
  onSelectSample: (corpusId: string) => void;
  isLoading: boolean;
  samples?: any[];
}

interface SampleCardData {
  corpusId: string;
  title: string;
  patternName: string;
  category: 'hidden_charges' | 'cancellation' | 'consent';
  categoryLabel: string;
  tags: string[];
  auditCode: string;
  mockup: {
    headerLeft: string;
    headerRight: string;
    headerRightBadge?: boolean;
    flagText?: string;
    flagPrice?: string;
    flagType?: 'resort' | 'check' | 'cookie' | 'terms' | 'carbon';
    subtext?: string;
    actionButtonText?: string;
    actionLinkText?: string;
    footerLeft?: string;
    footerRight?: string;
    isSubtotal?: boolean;
  };
}

// The 6 ground-truth illustrative samples mapped to our real verified corpus IDs
const SAMPLE_CASES: SampleCardData[] = [
  {
    corpusId: 'charges_drip_pricing',
    title: 'Hotel booking with a late resort fee',
    patternName: 'Drip pricing',
    category: 'hidden_charges',
    categoryLabel: 'Hidden charges',
    tags: ['Hidden charges', 'Drip pricing'],
    auditCode: '#CC-4019',
    mockup: {
      headerLeft: 'Grand Riviera Suites',
      headerRight: '$189 / night',
      flagText: 'Mandatory Facility Levy',
      flagPrice: '+$42.50',
      flagType: 'resort',
      footerLeft: 'Checkout Total',
      footerRight: '$231.50',
    },
  },
  {
    corpusId: 'cancel_asymmetric_flow',
    title: 'Streaming subscription with hidden renewal',
    patternName: 'Trap door',
    category: 'cancellation',
    categoryLabel: 'Cancellation',
    tags: ['Subscription', 'Cancellation'],
    auditCode: '#CC-8102',
    mockup: {
      headerLeft: 'CinePulse Prime',
      headerRight: 'Free for 7 Days',
      headerRightBadge: true,
      subtext: '*After 7 days, auto-bills $29.99/mo indefinitely. Cancelable only via formal post or call center.',
      actionButtonText: 'Start Free Access',
      flagType: 'terms',
    },
  },
  {
    corpusId: 'consent_preticked',
    title: 'Flight checkout with pre-ticked travel insurance',
    patternName: 'Pre-selected',
    category: 'consent',
    categoryLabel: 'Consent',
    tags: ['Consent', 'Pre-ticked box'],
    auditCode: '#CC-1194',
    mockup: {
      headerLeft: 'Flight LH-402 (BER → JFK)',
      headerRight: '$480.00',
      flagText: 'Flight Protect Bronze',
      flagPrice: '+$34.00',
      flagType: 'check',
      subtext: 'Pre-selected recommended companion safeguard',
      footerLeft: 'Subtotal',
      footerRight: '$514.00',
      isSubtotal: true,
    },
  },
  {
    corpusId: 'consent_asymmetric_buttons',
    title: 'Cookie consent with asymmetric reject styling',
    patternName: 'Asymmetry',
    category: 'consent',
    categoryLabel: 'Consent',
    tags: ['Consent', 'Contrast fail'],
    auditCode: '#CC-7731',
    mockup: {
      headerLeft: 'We respect your privacy',
      headerRight: '',
      flagType: 'cookie',
      actionButtonText: 'Accept All Cookies & Continue',
      actionLinkText: 'reject optional (settings)',
    },
  },
  {
    corpusId: 'cancel_confirm_shaming',
    title: 'Free trial checkout with obscured terms',
    patternName: 'Roosting terms',
    category: 'cancellation',
    categoryLabel: 'Cancellation',
    tags: ['Hidden terms', 'Cancellation'],
    auditCode: '#CC-9052',
    mockup: {
      headerLeft: 'Pro SaaS Workspace',
      headerRight: '$0.00 Due Today',
      flagType: 'terms',
      subtext: 'Cancellation requires written notice 30 days prior to annual cycle transition.',
      actionButtonText: 'Activate 14-Day Pass',
    },
  },
  {
    corpusId: 'charges_microprint_fee',
    title: 'Retail basket with auto-added donation fee',
    patternName: 'Sneak in',
    category: 'hidden_charges',
    categoryLabel: 'Hidden charges',
    tags: ['Hidden charges', 'Sneak into basket'],
    auditCode: '#CC-3329',
    mockup: {
      headerLeft: 'Order Basket (1 item)',
      headerRight: '$59.00',
      flagText: 'Auto-Carbon Offset',
      flagPrice: '+$3.50',
      flagType: 'carbon',
      subtext: 'Shipping: Standard Free',
      footerLeft: 'Total',
      footerRight: '$62.50',
    },
  },
];

export const SamplePagesCarousel: React.FC<SamplePagesCarouselProps> = ({
  onSelectSample,
  isLoading,
}) => {
  const carouselRegionRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLElement | null)[]>([]);
  const [activePip, setActivePip] = useState<number>(0);
  const [isEngaged, setIsEngaged] = useState<boolean>(false);
  const totalCards = SAMPLE_CASES.length;
  const baseSpeed = 0.115; // cards/sec continuous gentle drift

  // Mutable animation state references to avoid React render loop overhead
  const stateRef = useRef({
    pos: 0,
    isEngaged: false,
    targetSpeed: baseSpeed,
    currentSpeed: baseSpeed,
    cardWidth: 390,
    gap: 28,
    step: 418,
    isUserPaused: false,
    isHovered: false,
    isFocused: false,
    isDocumentHidden: false,
    isIntersecting: true,
    prefersReducedMotion: false,
    isBlurDisabled: false,
    slowFrameCount: 0,
    frameCheckTotal: 0,
    isTweening: false,
    tweenStartPos: 0,
    tweenTargetPos: 0,
    tweenStartTime: 0,
    tweenDuration: 600,
    isDragging: false,
    dragStartX: 0,
    dragStartPos: 0,
    dragDistanceX: 0,
    lastDragX: 0,
    dragVelocity: 0,
    lastDragTime: 0,
    resumeTimer: null as any,
  });

  const measureLayout = useCallback(() => {
    const isMobile = window.innerWidth < 640;
    const width = isMobile ? 340 : 390;
    const gap = isMobile ? 20 : 28;
    stateRef.current.cardWidth = width;
    stateRef.current.gap = gap;
    stateRef.current.step = width + gap;
  }, []);

  const easeInOutCubic = (t: number) => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  const getCardStyles = (d: number, prefersReducedMotion: boolean, isBlurDisabled: boolean) => {
    const absD = Math.abs(d);

    if (prefersReducedMotion) {
      const isCurrent = absD < 0.5;
      return {
        scale: 1,
        opacity: absD < 1.5 ? 1 : 0,
        blur: 0,
        veil: isCurrent ? 0 : 0.4,
        visible: absD < 2.5,
      };
    }

    let scale: number, opacity: number, blur: number, veil: number, visible: boolean;

    if (absD <= 0.6) {
      const t = absD / 0.6;
      scale = 1.06 - (1.06 - 1.03) * t;
      opacity = 1.0;
      blur = 0;
      veil = 0;
      visible = true;
    } else if (absD <= 1.2) {
      const t = (absD - 0.6) / 0.6;
      scale = 1.03 - (1.03 - 0.95) * t;
      opacity = 1.0 - (1.0 - 0.92) * t;
      blur = 1.0 * t;
      veil = 0.05 * t;
      visible = true;
    } else if (absD <= 2.0) {
      const t = (absD - 1.2) / 0.8;
      scale = 0.95 - (0.95 - 0.86) * t;
      opacity = 0.92 - (0.92 - 0.60) * t;
      blur = 1.0 + (3.5 - 1.0) * t;
      veil = 0.05 + (0.30 - 0.05) * t;
      visible = true;
    } else if (absD <= 3.0) {
      const t = (absD - 2.0) / 1.0;
      scale = 0.86 - (0.86 - 0.80) * t;
      opacity = 0.60 * (1 - t);
      blur = 3.5 + (8.0 - 3.5) * t;
      veil = 0.30 + (0.70 - 0.30) * t;
      visible = absD < 2.95;
    } else {
      scale = 0.80;
      opacity = 0;
      blur = 8.0;
      veil = 0.70;
      visible = false;
    }

    if (isBlurDisabled) blur = 0;
    else blur = Math.round(blur * 2) / 2;

    return { scale, opacity, blur, veil, visible };
  };

  const scheduleResumeAutoplay = useCallback(
    (delay = 1500) => {
      const s = stateRef.current;
      if (s.resumeTimer) clearTimeout(s.resumeTimer);
      s.resumeTimer = setTimeout(() => {
        if (!s.isDocumentHidden && s.isIntersecting && !s.prefersReducedMotion && !isLoading) {
          s.isFocused = false;
          s.targetSpeed = baseSpeed;
        }
      }, delay);
    },
    [baseSpeed, isLoading]
  );

  const tweenToCard = useCallback(
    (targetIndex: number, userInitiated = true, duration = 400) => {
      const s = stateRef.current;
      const currentNorm = ((s.pos % totalCards) + totalCards) % totalCards;
      let diff = (targetIndex - currentNorm) % totalCards;
      if (diff > totalCards / 2) diff -= totalCards;
      if (diff < -totalCards / 2) diff += totalCards;

      s.tweenStartPos = s.pos;
      s.tweenTargetPos = s.pos + diff;
      s.tweenStartTime = performance.now();
      s.tweenDuration = duration;
      s.isTweening = true;
      s.targetSpeed = 0;
      s.currentSpeed = 0;

      if (userInitiated) {
        scheduleResumeAutoplay(1800);
      }
    },
    [totalCards, scheduleResumeAutoplay]
  );

  const tweenByDelta = useCallback(
    (cardDelta: number, duration = 380) => {
      const s = stateRef.current;
      // If already tweening towards a target, build onto that target so rapid wheels queue up smoothly
      const basePos = s.isTweening ? s.tweenTargetPos : s.pos;
      const targetPos = Math.round(basePos + cardDelta);

      s.tweenStartPos = s.pos;
      s.tweenTargetPos = targetPos;
      s.tweenStartTime = performance.now();
      s.tweenDuration = duration;
      s.isTweening = true;
      s.targetSpeed = 0;
      s.currentSpeed = 0;

      scheduleResumeAutoplay(1800);
    },
    [scheduleResumeAutoplay]
  );

  const updatePlayState = useCallback(() => {
    const s = stateRef.current;
    if (
      s.isHovered ||
      s.isDocumentHidden ||
      !s.isIntersecting ||
      s.prefersReducedMotion ||
      isLoading
    ) {
      s.targetSpeed = 0;
      if (s.isHovered) {
        scheduleResumeAutoplay(2500);
      }
    } else {
      s.targetSpeed = baseSpeed;
    }
  }, [baseSpeed, isLoading, scheduleResumeAutoplay]);

  useEffect(() => {
    measureLayout();
    const handleResize = () => measureLayout();
    window.addEventListener('resize', handleResize);

    const s = stateRef.current;
    s.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    s.isBlurDisabled = s.prefersReducedMotion;

    let animId: number;
    let lastTime: number | null = null;

    const render = () => {
      const currentPos = s.pos;
      const isDark = document.documentElement.classList.contains('dark');

      cardsRef.current.forEach((card, i) => {
        if (!card) return;
        const d = ((i - currentPos + 3) % totalCards + totalCards) % totalCards - 3;
        const absD = Math.abs(d);
        const st = getCardStyles(d, s.prefersReducedMotion, s.isBlurDisabled);

        const x = d * s.step;
        const zIndex = Math.round(100 - 10 * absD);

        card.style.transform = `translate3d(${x}px, 0, 0) scale(${st.scale})`;
        card.style.opacity = st.opacity.toString();
        card.style.zIndex = zIndex.toString();
        card.style.visibility = st.visible ? 'visible' : 'hidden';

        if (st.blur === 0) {
          card.style.filter = '';
        } else {
          card.style.filter = `blur(${st.blur}px)`;
        }

        card.style.setProperty('--veil-opacity', st.veil.toFixed(3));

        // Smooth Center Border Highlight Interpolation
        let highlightT = 0;
        if (absD <= 0.4) {
          highlightT = 1;
        } else if (absD < 1.0) {
          highlightT = (1.0 - absD) / 0.6;
        } else {
          highlightT = 0;
        }

        if (highlightT > 0.005) {
          if (isDark) {
            const glowAlpha = (0.16 * highlightT).toFixed(3);
            card.style.borderColor = `rgba(251, 227, 106, ${(0.3 + 0.5 * highlightT).toFixed(2)})`;
            card.style.boxShadow = `0 0 18px rgba(251, 227, 106, ${glowAlpha})`;
          } else {
            const glowAlpha = (0.18 * highlightT).toFixed(3);
            card.style.borderColor = `rgba(245, 158, 11, ${(0.6 + 0.4 * highlightT).toFixed(2)})`;
            card.style.boxShadow = `0 10px 25px -5px rgba(234, 179, 8, ${glowAlpha}), 0 8px 10px -6px rgba(0, 0, 0, 0.04)`;
          }
        } else {
          card.style.borderColor = isDark ? 'rgba(75, 71, 54, 0.35)' : 'rgba(203, 213, 225, 0.7)';
          card.style.boxShadow = isDark ? 'none' : '0 1px 3px 0 rgba(0, 0, 0, 0.05)';
        }

        if (absD <= 1.2) {
          card.removeAttribute('inert');
          card.removeAttribute('aria-hidden');
        } else {
          card.setAttribute('inert', '');
          card.setAttribute('aria-hidden', 'true');
        }
      });

      const currentActive = ((Math.round(currentPos) % totalCards) + totalCards) % totalCards;
      setActivePip(currentActive);
    };

    const tick = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      let dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;
      dt = Math.min(dt, 0.05);

      if (!s.isBlurDisabled) {
        s.frameCheckTotal++;
        if (dt > 0.02) s.slowFrameCount++;
        if (s.frameCheckTotal >= 60) {
          if (s.slowFrameCount > 15) {
            s.isBlurDisabled = true;
          }
          s.slowFrameCount = 0;
          s.frameCheckTotal = 0;
        }
      }

      if (s.isTweening) {
        const elapsed = timestamp - s.tweenStartTime;
        const progress = Math.min(elapsed / s.tweenDuration, 1.0);
        const ease = easeInOutCubic(progress);
        s.pos = s.tweenStartPos + (s.tweenTargetPos - s.tweenStartPos) * ease;
        if (progress >= 1.0) {
          s.isTweening = false;
          s.pos = ((s.tweenTargetPos % totalCards) + totalCards) % totalCards;
          scheduleResumeAutoplay(1200);
        }
      } else {
        const alpha = 1 - Math.exp(-dt / 0.25);
        s.currentSpeed += (s.targetSpeed - s.currentSpeed) * alpha;

        if (Math.abs(s.currentSpeed) > 0.0001 && !s.prefersReducedMotion) {
          s.pos = (s.pos + s.currentSpeed * dt) % totalCards;
          if (s.pos < 0) s.pos += totalCards;
        }
      }

      render();
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    const handleGlobalPointer = () => {
      // Re-enable and schedule gentle drift after user clicks anywhere
      scheduleResumeAutoplay(1200);
    };
    window.addEventListener('pointerup', handleGlobalPointer);
    window.addEventListener('pointercancel', handleGlobalPointer);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerup', handleGlobalPointer);
      window.removeEventListener('pointercancel', handleGlobalPointer);
      cancelAnimationFrame(animId);
      if (s.resumeTimer) clearTimeout(s.resumeTimer);
    };
  }, [totalCards, measureLayout, scheduleResumeAutoplay]);

  // Two-finger trackpad swipe and mouse scroll-wheel navigation
  const wheelRef = useRef({
    lastWheelTime: 0,
    wheelTimeout: null as any,
    isContinuous: false,
    velocity: 0,
    lastDelta: 0,
  });

  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const handleWheel = (e: WheelEvent) => {
      // Only capture wheel / 2-finger scroll if the user has hard clicked on a card to engage the carousel!
      // When not engaged, let the browser scroll down the webpage naturally without trapping.
      if (!stateRef.current.isEngaged) {
        return;
      }

      // Prevent window vertical scroll jump while user is actively scrolling through carousel cards
      e.preventDefault();

      const s = stateRef.current;
      const w = wheelRef.current;
      const now = performance.now();
      const timeSinceLast = now - w.lastWheelTime;
      w.lastWheelTime = now;

      // Detect dominant axis: supports horizontal 2-finger swipe, vertical wheel, or Shift+wheel
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      let dominantDelta = absX > absY ? e.deltaX : e.deltaY;

      // Normalization for deltaMode:
      // deltaMode 1 = lines (standard mouse wheel notch on Windows/Linux is typically 3 lines)
      // deltaMode 2 = pages
      if (e.deltaMode === 1) {
        dominantDelta *= 32;
      } else if (e.deltaMode === 2) {
        dominantDelta *= s.step;
      }

      // Detection of discrete mouse wheel clicks vs continuous trackpad 2-finger stream:
      // Mouse wheels fire discrete jumps (>= 48px or non-zero deltaMode) with intervals > 50ms.
      // 2-finger trackpad fires high-frequency smooth float/small pixel deltas (< 48px or interval < 50ms).
      const isDiscreteClick =
        e.deltaMode !== 0 ||
        (Math.abs(dominantDelta) >= 48 && timeSinceLast > 50 && !w.isContinuous);

      if (isDiscreteClick) {
        // Discrete Mouse Scroll Wheel:
        // Advance 1 card per notch in the scroll direction, smooth and responsive (not too slow).
        w.isContinuous = false;
        if (w.wheelTimeout) clearTimeout(w.wheelTimeout);

        const dir = dominantDelta > 0 ? 1 : -1;
        tweenByDelta(dir, 380);
      } else {
        // Continuous 2-Finger Trackpad Gesture:
        w.isContinuous = true;
        s.isTweening = false;
        s.targetSpeed = 0;
        s.currentSpeed = 0;

        // Tuned 1.35x responsiveness multiplier: feels light, fluid, and never sluggish
        const sensitivity = 1.35;
        const cardDelta = (dominantDelta / s.step) * sensitivity;

        s.pos = (s.pos + cardDelta) % totalCards;
        if (s.pos < 0) s.pos += totalCards;

        // Measure instant velocity for momentum flick
        const dt = Math.max(timeSinceLast / 1000, 0.008);
        w.velocity = cardDelta / dt;

        // Debounce end of 2-finger gesture and snap to closest card with momentum
        if (w.wheelTimeout) clearTimeout(w.wheelTimeout);
        w.wheelTimeout = setTimeout(() => {
          w.isContinuous = false;
          // Projected flick offset based on release velocity (capped between -1.5 and 1.5 cards)
          const momentumOffset = Math.max(Math.min(w.velocity * 0.12, 1.5), -1.5);
          const target = Math.round(s.pos + momentumOffset);
          const targetIndex = ((target % totalCards) + totalCards) % totalCards;
          tweenToCard(targetIndex, true, 360);
          w.velocity = 0;
        }, 95);
      }
    };

    stageEl.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      stageEl.removeEventListener('wheel', handleWheel);
      if (wheelRef.current.wheelTimeout) {
        clearTimeout(wheelRef.current.wheelTimeout);
      }
    };
  }, [totalCards, tweenToCard, tweenByDelta]);

  // Pointer drag interactions
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const s = stateRef.current;
    s.isDragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    s.dragStartX = e.clientX;
    s.lastDragX = e.clientX;
    s.dragDistanceX = 0;
    s.dragStartPos = s.pos;
    s.dragVelocity = 0;
    s.lastDragTime = performance.now();
    s.isTweening = false;
    s.targetSpeed = 0;
    s.currentSpeed = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.isDragging) return;
    const now = performance.now();
    const currentX = e.clientX;
    const deltaX = currentX - s.dragStartX;
    s.dragDistanceX = Math.abs(deltaX);

    const frameDt = (now - s.lastDragTime) / 1000;
    if (frameDt > 0.005) {
      s.dragVelocity = (currentX - s.lastDragX) / (s.step * frameDt);
      s.lastDragX = currentX;
      s.lastDragTime = now;
    }

    s.pos = s.dragStartPos - deltaX / s.step;
  };

  const handleFinishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.isDragging) return;
    s.isDragging = false;
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (s.dragDistanceX > 6) {
      const target = s.pos - s.dragVelocity * 0.18;
      const rounded = Math.round(target);
      tweenToCard(((rounded % totalCards) + totalCards) % totalCards);
    } else {
      const rounded = Math.round(s.pos);
      tweenToCard(((rounded % totalCards) + totalCards) % totalCards, false);
    }
  };

  // Disengage carousel wheel capture when clicking outside
  useEffect(() => {
    const handleGlobalClickOutside = (e: MouseEvent | TouchEvent) => {
      if (carouselRegionRef.current && !carouselRegionRef.current.contains(e.target as Node)) {
        setIsEngaged(false);
        stateRef.current.isEngaged = false;
      }
    };
    window.addEventListener('mousedown', handleGlobalClickOutside);
    window.addEventListener('touchstart', handleGlobalClickOutside, { passive: true });
    return () => {
      window.removeEventListener('mousedown', handleGlobalClickOutside);
      window.removeEventListener('touchstart', handleGlobalClickOutside);
    };
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const s = stateRef.current;
    if (e.key === 'Escape') {
      setIsEngaged(false);
      s.isEngaged = false;
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIdx = (Math.round(s.pos) + 1 + totalCards) % totalCards;
      tweenToCard(nextIdx);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIdx = (Math.round(s.pos) - 1 + totalCards) % totalCards;
      tweenToCard(prevIdx);
    }
  };

  const handleCardClick = (idx: number, corpusId: string) => {
    if (isLoading) return;
    const s = stateRef.current;

    // Hard click on a card explicitly engages the wheel/2-finger scroll mode
    setIsEngaged(true);
    s.isEngaged = true;

    const d = ((idx - s.pos + 3) % totalCards + totalCards) % totalCards - 3;
    if (Math.abs(d) >= 0.4) {
      tweenToCard(idx, true, 400);
      scheduleResumeAutoplay(2500);
    } else {
      onSelectSample(corpusId);
      scheduleResumeAutoplay(1500);
    }
  };

  return (
    <section
      ref={carouselRegionRef}
      aria-label="Dark pattern proofing samples"
      aria-roledescription="carousel"
      className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 outline-none my-6 select-none"
      role="region"
      onKeyDown={handleKeyDown}
      onMouseEnter={() => {
        stateRef.current.isHovered = true;
        updatePlayState();
      }}
      onMouseLeave={() => {
        stateRef.current.isHovered = false;
        stateRef.current.isFocused = false;
        scheduleResumeAutoplay(400);
      }}
      onFocus={() => {
        scheduleResumeAutoplay(2500);
      }}
      onBlur={() => {
        stateRef.current.isFocused = false;
        scheduleResumeAutoplay(400);
      }}
    >
      {/* Section Header & Accessible Controls */}
      <div className="flex items-end justify-between max-w-4xl mx-auto mb-3 px-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider font-semibold text-stone-900">
            Examples
          </span>
          <span className="text-stone-400 font-mono text-xs">/</span>
          <span className="text-xs text-stone-600">
            Illustrative examples, not from real sites.
          </span>
        </div>

        {/* Dynamic Engagement Indicator */}
        {isEngaged && (
          <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Card focused</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEngaged(false);
                stateRef.current.isEngaged = false;
              }}
              className="underline font-semibold hover:text-amber-950 cursor-pointer ml-1"
              title="Release card focus"
            >
              Release
            </button>
          </div>
        )}
      </div>

      {/* Carousel Stage Wrapper */}
      <div
        ref={stageRef}
        className={`relative w-full h-[380px] overflow-hidden flex items-center justify-center touch-pan-y transition-all duration-300 ${isEngaged ? 'ring-2 ring-amber-400/60 rounded-2xl' : ''}`}
        id="carousel-stage"
      >
        {/* Track Element with pure CSS mask-image edge fade */}
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handleFinishDrag}
          onPointerCancel={handleFinishDrag}
          className="relative w-full h-full flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
          id="carousel-track"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 14%, #000 86%, transparent 100%)',
            maskImage: 'linear-gradient(to right, transparent 0%, #000 14%, #000 86%, transparent 100%)',
          }}
        >
          {SAMPLE_CASES.map((item, idx) => (
            <article
              key={item.corpusId}
              ref={(el) => (cardsRef.current[idx] = el)}
              onClick={() => handleCardClick(idx, item.corpusId)}
              aria-label={`${idx + 1} of ${totalCards}: ${item.title}`}
              aria-roledescription="slide"
              data-index={idx}
              className="sample-card group absolute top-1/2 left-1/2 -translate-y-1/2 w-[340px] sm:w-[390px] h-[350px] bg-white rounded-xl p-4 flex flex-col justify-between border border-stone-200 shadow-sm will-change-transform focus-within:ring-2 focus-within:ring-amber-500 cursor-pointer"
              style={{
                left: '50%',
                top: '50%',
                marginLeft: '-195px',
                marginTop: '-175px',
              }}
            >
              {/* Card Frosted Veil Layer */}
              <div
                aria-hidden="true"
                className="card-veil absolute inset-0 rounded-xl pointer-events-none bg-[#f7f9fb] transition-none z-20"
                style={{ opacity: 'var(--veil-opacity, 0)' }}
              />

              {/* Mockup Frame 16:10 aspect ratio */}
              <div className="w-full aspect-[16/10] bg-stone-50 rounded-lg overflow-hidden relative p-3 font-mono text-xs flex flex-col justify-between border border-stone-200/80">
                {/* Mockup Header */}
                <div className="flex items-center justify-between pb-1">
                  <span className="text-stone-900 font-semibold truncate max-w-[210px]">
                    {item.mockup.headerLeft}
                  </span>
                  {item.mockup.headerRight && (
                    item.mockup.headerRightBadge ? (
                      <span className="px-2 py-0.5 bg-amber-200 text-stone-900 rounded font-bold text-[10px]">
                        {item.mockup.headerRight}
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold text-[11px]">
                        {item.mockup.headerRight}
                      </span>
                    )
                  )}
                </div>

                {/* Mockup Body Content according to sample case */}
                <div className="my-auto space-y-1.5">
                  {item.mockup.flagType === 'resort' && (
                    <>
                      <div className="h-2 w-3/4 bg-stone-200 rounded" />
                      <div className="h-2 w-1/2 bg-stone-200/60 rounded" />
                      <div className="p-2 rounded bg-amber-50 border border-amber-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Flag className="w-3.5 h-3.5 text-rose-600" />
                          <span className="text-[11px] font-medium text-stone-900">
                            {item.mockup.flagText}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-rose-600">
                          {item.mockup.flagPrice}
                        </span>
                      </div>
                    </>
                  )}

                  {item.mockup.flagType === 'terms' && (
                    <>
                      <div className="h-2 w-full bg-stone-200 rounded" />
                      <div className="p-2 rounded bg-rose-50/80 border border-rose-200/80">
                        <p className="text-[9px] leading-3 text-rose-700">
                          {item.mockup.subtext}
                        </p>
                      </div>
                    </>
                  )}

                  {item.mockup.flagType === 'check' && (
                    <div className="p-2 bg-amber-50 border border-amber-200/80 rounded-md flex items-start gap-2">
                      <div className="w-4 h-4 mt-0.5 bg-amber-400 text-stone-900 rounded flex items-center justify-center font-bold">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[11px] font-medium text-stone-900 flex justify-between">
                          <span>{item.mockup.flagText}</span>
                          <span className="text-rose-600 font-semibold">{item.mockup.flagPrice}</span>
                        </div>
                        <span className="text-[9px] text-stone-500 block">{item.mockup.subtext}</span>
                      </div>
                    </div>
                  )}

                  {item.mockup.flagType === 'cookie' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-stone-900 text-[11px]">
                        <Cookie className="w-3.5 h-3.5 text-amber-600" />
                        <span>Cookie preferences banner</span>
                      </div>
                      <div className="h-1.5 w-full bg-stone-200 rounded" />
                    </div>
                  )}

                  {item.mockup.flagType === 'carbon' && (
                    <>
                      <div className="p-2 rounded bg-amber-50 border border-amber-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5 text-rose-600" />
                          <span className="text-[11px] font-medium text-stone-900">
                            {item.mockup.flagText}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-rose-600">
                          {item.mockup.flagPrice}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-500 px-1">
                        <span>{item.mockup.subtext}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Mockup Action / Footer Area */}
                {item.mockup.actionButtonText && (
                  <div className="space-y-1 mt-auto">
                    <div className="w-full py-1.5 bg-amber-400 text-stone-900 rounded font-semibold text-[11px] text-center shadow-xs">
                      {item.mockup.actionButtonText}
                    </div>
                    {item.mockup.actionLinkText && (
                      <div className="flex justify-center">
                        <span className="text-[9px] text-stone-400 underline">
                          {item.mockup.actionLinkText}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {item.mockup.footerLeft && (
                  <div className="flex items-center justify-between pt-1 border-t border-stone-200">
                    <span className="text-[10px] text-stone-500">{item.mockup.footerLeft}</span>
                    <span className="text-[11px] font-bold text-rose-600">{item.mockup.footerRight}</span>
                  </div>
                )}
              </div>

              {/* Card Meta & Header */}
              <div className="mt-2.5 flex flex-col gap-1 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                    Illustrative sample
                  </span>
                  <span className="font-mono text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> {item.patternName}
                  </span>
                </div>
                <h2 className="font-serif text-base text-stone-900 leading-tight font-medium line-clamp-1 group-hover:text-amber-600:text-[#FBE36A] transition-colors">
                  {item.title}
                </h2>
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded bg-stone-100 font-mono text-[10px] text-stone-600 border border-stone-200/80"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Bottom Row: Audit Code */}
              <div className="mt-2 pt-2 border-t border-stone-200/70 flex items-center justify-between relative z-10">
                <span className="font-mono text-[10px] text-stone-400">
                  Audit code: {item.auditCode}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Accessible Indicator Pips */}
      <div aria-hidden="true" className="flex items-center justify-center gap-2 mt-4" id="carousel-pips">
        {SAMPLE_CASES.map((_, pIdx) => (
          <button
            key={pIdx}
            type="button"
            onClick={() => tweenToCard(pIdx)}
            className={`transition-all h-1 rounded ${
              pIdx === activePip
                ? 'w-6 bg-amber-500'
                : 'w-2 bg-stone-200 hover:bg-stone-400:bg-stone-500'
            }`}
            title={`Slide ${pIdx + 1}`}
            aria-label={`Go to slide ${pIdx + 1}`}
          />
        ))}
      </div>
    </section>
  );
};
