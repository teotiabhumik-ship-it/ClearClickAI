import React from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-surface-container-low border-b border-outline-variant/30">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[24px]">verified</span>
            <div>
              <h3 className="text-base font-bold text-on-surface">About ClearClick AI</h3>
              <p className="text-xs text-on-surface-variant">Consumer Rights & Fair Interface Architecture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-on-surface-variant hover:text-on-surface bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/30 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] block">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-on-surface leading-relaxed">
          {/* Mission */}
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
            <h4 className="font-semibold text-primary mb-1 flex items-center gap-1.5 text-sm">
              <span className="material-symbols-outlined text-[18px]">gavel</span>
              Evidence, Not Accusations
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              ClearClick AI is an independent prototype designed to help everyday consumers identify manipulative and deceptive web patterns (dark patterns). Rather than issuing vague or subjective accusations, ClearClick measures concrete interface evidence: contrast ratios, button size asymmetries, multi-step cancellation friction, and surprise checkout fees.
            </p>
          </div>

          {/* Three Focus Areas */}
          <div>
            <h4 className="font-semibold text-on-surface mb-2 text-xs uppercase tracking-wider text-outline">
              Three Core Inspection Areas
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/30">
                <span className="material-symbols-outlined text-primary text-[20px] mb-1">payments</span>
                <h5 className="font-semibold text-xs text-on-surface">Hidden Charges</h5>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Drip pricing, microprint surcharges, and stealth bundled items.</p>
              </div>
              <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/30">
                <span className="material-symbols-outlined text-primary text-[20px] mb-1">block</span>
                <h5 className="font-semibold text-xs text-on-surface">Cancellation</h5>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Buried unsubscribe links, asymmetric step mazes, and guilt-trip copy.</p>
              </div>
              <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/30">
                <span className="material-symbols-outlined text-primary text-[20px] mb-1">rule</span>
                <h5 className="font-semibold text-xs text-on-surface">Manipulative Consent</h5>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Asymmetric cookie buttons, pre-ticked opt-ins, and confusing double negatives.</p>
              </div>
            </div>
          </div>

          {/* Technology */}
          <div>
            <h4 className="font-semibold text-on-surface mb-2 text-xs uppercase tracking-wider text-outline">
              Hybrid Rule Engine + Gemini AI
            </h4>
            <ul className="space-y-2 text-xs text-on-surface-variant">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">check_circle</span>
                <span><strong>Deterministic Rule Detectors:</strong> Millisecond DOM analysis for exact WCAG contrast ratios, bounding boxes, and computed styles.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">check_circle</span>
                <span><strong>Multimodal Vision & Language:</strong> Gemini 2.5 Flash Lite analyzes visual hierarchy and layout prominence with bounding box mapping.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">check_circle</span>
                <span><strong>Anti-Hallucination Quote Verifier:</strong> Every AI finding is verified against the actual page text before inclusion in the final report.</span>
              </li>
            </ul>
          </div>

          {/* Neutral Disclaimer */}
          <div className="p-3 bg-surface-container rounded-lg border border-outline-variant/30 text-xs text-on-surface-variant flex items-start gap-2">
            <span className="material-symbols-outlined text-outline text-[16px] shrink-0 mt-0.5">info</span>
            <span>
              <strong>Disclaimer:</strong> ClearClick AI findings are automated warnings for human review, not legal conclusions. Results reflect automated inspections based on observable interface evidence.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-surface-container-low border-t border-outline-variant/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-xs font-semibold hover:opacity-95 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
