import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ArrowRight, Shield, CheckCircle, HelpCircle } from 'lucide-react';
import { aboutConfig } from '../config/about';
import pkg from '../../package.json';

export const AboutPage: React.FC = () => {
  const version = pkg.version || '1.0.0';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-12 pb-16">
      {/* Header */}
      <header className="space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] text-xs font-semibold w-fit border border-outline-variant/30 dark:border-[#26324A]">
          <Shield className="w-3.5 h-3.5 text-primary dark:text-[#2DD4BF]" aria-hidden="true" />
          <span>Student Prototype • v{version}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface dark:text-[#E2E8F0] tracking-tight outline-none">
          About ClearClick AI
        </h1>
        <p className="text-on-surface-variant dark:text-[#94A3B8] text-base sm:text-lg leading-relaxed max-w-2xl">
          An honest, evidence-first tool helping everyday people understand deceptive interface design.
        </p>
      </header>

      {/* 1. Why ClearClick Exists */}
      <section className="p-6 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-3">
        <h2 className="text-xl font-bold text-on-surface dark:text-[#E2E8F0]">Why ClearClick exists</h2>
        <p className="text-base text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
          Modern digital products frequently rely on subtle friction—pre-ticked consents, hidden checkout fees, and obfuscated cancellation links—that manipulate consumer choice. ClearClick exists to re-balance that information gap by highlighting verifiable evidence directly on the page. We provide calm, measurable clarity so people can evaluate interface choices without fear or alarmism.
        </p>
      </section>

      {/* 2. Who It Is For */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-on-surface dark:text-[#E2E8F0]">Who it is for</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-1">
            <h3 className="font-semibold text-base text-on-surface dark:text-[#E2E8F0]">Everyday shoppers</h3>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
              Verify checkout pages before entering payment details to uncover surprise fees and sneaky recurring subscriptions.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-1">
            <h3 className="font-semibold text-base text-on-surface dark:text-[#E2E8F0]">Students and reviewers</h3>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
              Explore concrete, observable dark pattern mechanics backed by academic literature and test suites.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-1">
            <h3 className="font-semibold text-base text-on-surface dark:text-[#E2E8F0]">Designers and developers</h3>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
              Review actionable safer design alternatives and contrast recommendations for ethical UI systems.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-1">
            <h3 className="font-semibold text-base text-on-surface dark:text-[#E2E8F0]">Project evaluators</h3>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
              Inspect transparent evaluation metrics, test cases, and honest precision/recall statistics.
            </p>
          </div>
        </div>
      </section>

      {/* 3. How To Use It */}
      <section className="p-6 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-4">
        <h2 className="text-xl font-bold text-on-surface dark:text-[#E2E8F0]">How to use it</h2>
        <ol className="list-decimal list-inside space-y-2 text-base text-on-surface-variant dark:text-[#94A3B8]">
          <li><strong>Provide a page:</strong> Enter a web address, upload an HTML document or screenshot, or select a demo fixture.</li>
          <li><strong>Read the evidence:</strong> Inspect visual highlight boxes, exact quoted text, and measured contrast ratios.</li>
          <li><strong>Decide for yourself:</strong> Review plain explanations and safer alternatives to make an informed choice.</li>
        </ol>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary dark:bg-[#2DD4BF] text-on-primary dark:text-[#0B1220] font-semibold text-sm hover:opacity-95 transition-opacity focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span>Analyse a page</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* 4. Principles */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-on-surface dark:text-[#E2E8F0]">Guiding principles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-1">
            <h3 className="font-semibold text-base text-on-surface dark:text-[#E2E8F0]">Evidence first</h3>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8]">
              Every finding must cite exact captured text, bounding box coordinates, or CSS measurements.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-1">
            <h3 className="font-semibold text-base text-on-surface dark:text-[#E2E8F0]">Warn, never accuse</h3>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8]">
              We describe specific design patterns that may mislead users. We never call a site "fraud" and give no legal conclusions.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-1">
            <h3 className="font-semibold text-base text-on-surface dark:text-[#E2E8F0]">Calm, not alarming</h3>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8]">
              Information is delivered neutrally and clearly, avoiding fear tactics, aggressive banners, or sensationalism.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-1">
            <h3 className="font-semibold text-base text-on-surface dark:text-[#E2E8F0]">No dark patterns of our own</h3>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8]">
              ClearClick has no user accounts, no tracking cookies, no paywalls, and no popups.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-1 sm:col-span-2">
            <h3 className="font-semibold text-base text-on-surface dark:text-[#E2E8F0]">Honest about limits</h3>
            <p className="text-sm text-on-surface-variant dark:text-[#94A3B8]">
              Automated auditing cannot detect every subtlety. Read our full discussion of{' '}
              <Link to="/methodology#limits" className="text-primary dark:text-[#2DD4BF] underline font-medium">
                known limits
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* 5. Status & Scope */}
      <section className="p-6 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-3">
        <h2 className="text-xl font-bold text-on-surface dark:text-[#E2E8F0]">Project status & scope</h2>
        <p className="text-base text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
          ClearClick is an academic <strong>prototype</strong> (version {version}).
        </p>
        <p className="text-sm sm:text-base text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
          <strong>Current Scope:</strong> Focused exclusively on three categories: hidden charges, cancellation hurdles, and one-sided consent choices.
        </p>
        <div className="pt-2 text-sm text-on-surface-variant dark:text-[#94A3B8]">
          <strong className="text-on-surface dark:text-[#E2E8F0]">Planned ideas (not promises):</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Browser extension for real-time browsing inspection</li>
            <li>Broader pattern coverage across multi-step purchase funnels</li>
            <li>Multi-language support for international shopping sites</li>
          </ul>
        </div>
      </section>

      {/* 6. Academic Research Credits */}
      <section className="p-6 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-4">
        <h2 className="text-xl font-bold text-on-surface dark:text-[#E2E8F0]">Academic research credits</h2>
        <p className="text-sm sm:text-base text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
          ClearClick builds upon peer-reviewed empirical research into dark patterns in digital interfaces:
        </p>
        <ul className="space-y-4 text-sm sm:text-base">
          <li className="flex items-start gap-2.5">
            <ExternalLink className="w-4 h-4 text-primary dark:text-[#2DD4BF] shrink-0 mt-1" aria-hidden="true" />
            <div>
              <span className="font-semibold text-on-surface dark:text-[#E2E8F0]">Mathur et al. (2019):</span>{' '}
              <a
                href="https://arxiv.org/abs/1907.07032v2"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary dark:text-[#2DD4BF] hover:underline"
              >
                Dark Patterns at Scale: Findings from a Crawl of 11K Shopping Websites
              </a>{' '}
              <span className="text-xs text-on-surface-variant dark:text-[#94A3B8] block sm:inline mt-0.5 sm:mt-0">
                (ACM CSCW 2019)
              </span>
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <ExternalLink className="w-4 h-4 text-primary dark:text-[#2DD4BF] shrink-0 mt-1" aria-hidden="true" />
            <div>
              <span className="font-semibold text-on-surface dark:text-[#E2E8F0]">Mansur et al. (2023):</span>{' '}
              <a
                href="https://arxiv.org/abs/2303.06782v1"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary dark:text-[#2DD4BF] hover:underline"
              >
                AidUI: Toward Automated Recognition of Dark Patterns in User Interfaces
              </a>{' '}
              <span className="text-xs text-on-surface-variant dark:text-[#94A3B8] block sm:inline mt-0.5 sm:mt-0">
                (ICSE 2023)
              </span>
            </div>
          </li>
        </ul>
      </section>

      {/* 7. Contact & Project Info */}
      <section className="p-6 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-3">
        <h2 className="text-xl font-bold text-on-surface dark:text-[#E2E8F0]">Contact & Project Details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {aboutConfig.name && (
            <div>
              <dt className="text-xs text-on-surface-variant dark:text-[#94A3B8] font-semibold">Author</dt>
              <dd className="font-medium text-on-surface dark:text-[#E2E8F0] mt-0.5">{aboutConfig.name}</dd>
            </div>
          )}
          {aboutConfig.course && (
            <div>
              <dt className="text-xs text-on-surface-variant dark:text-[#94A3B8] font-semibold">Course</dt>
              <dd className="font-medium text-on-surface dark:text-[#E2E8F0] mt-0.5">{aboutConfig.course}</dd>
            </div>
          )}
          {aboutConfig.institution && (
            <div>
              <dt className="text-xs text-on-surface-variant dark:text-[#94A3B8] font-semibold">Institution</dt>
              <dd className="font-medium text-on-surface dark:text-[#E2E8F0] mt-0.5">{aboutConfig.institution}</dd>
            </div>
          )}
          {aboutConfig.repoUrl && (
            <div>
              <dt className="text-xs text-on-surface-variant dark:text-[#94A3B8] font-semibold">Repository</dt>
              <dd className="mt-0.5">
                <a
                  href={aboutConfig.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary dark:text-[#2DD4BF] hover:underline font-medium inline-flex items-center gap-1"
                >
                  <span>Source Code</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </dd>
            </div>
          )}
        </dl>

        {aboutConfig.feedbackUrl ? (
          <div className="pt-2">
            <a
              href={aboutConfig.feedbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary dark:text-[#2DD4BF] hover:underline font-medium inline-flex items-center gap-1"
            >
              <span>Submit feedback</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
};
