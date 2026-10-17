import React from 'react';
import { ExternalLink, HelpCircle, Shield, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { privacyConfig } from '../config/privacy';
import evaluationData from '../data/evaluation.json';

export const MethodologyPage: React.FC = () => {
  const evalData = evaluationData;

  return (
    <div className="w-full max-w-6xl mx-auto lg:grid lg:grid-cols-[1fr_240px] lg:gap-12 items-start">
      {/* Main Content Column (Max ~720px) */}
      <div className="w-full max-w-[720px] mx-auto space-y-12 pb-16">
        {/* Editorial Header */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] text-xs font-semibold w-fit border border-outline-variant/30 dark:border-[#26324A]">
            <Shield className="w-3.5 h-3.5 text-primary dark:text-[#2DD4BF]" aria-hidden="true" />
            <span>Detection Standards & Evaluation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface dark:text-[#E2E8F0] tracking-tight outline-none focus:outline-none focus-visible:outline-none">
            Methodology
          </h1>
          <p className="text-on-surface-variant dark:text-[#94A3B8] text-base leading-relaxed">
            How ClearClick checks pages for potentially misleading interface patterns, how rules and AI analysis operate, and known limits of automated auditing.
          </p>
        </header>

        {/* Mobile Sticky Section Bar */}
        <nav aria-label="Methodology sections" className="lg:hidden sticky top-14 z-30 -mx-4 px-4 py-2 bg-surface/95 dark:bg-[#0B1220]/95 backdrop-blur-md border-b border-outline-variant/20 dark:border-[#26324A] flex items-center gap-2 overflow-x-auto text-sm">
          <a href="#what-it-checks" className="px-3 py-1 rounded-full bg-surface-container dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] whitespace-nowrap hover:bg-primary hover:text-white transition-colors">What it checks</a>
          <a href="#how-it-checks" className="px-3 py-1 rounded-full bg-surface-container dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] whitespace-nowrap hover:bg-primary hover:text-white transition-colors">How it checks</a>
          <a href="#multi-page-scanning" className="px-3 py-1 rounded-full bg-surface-container dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] whitespace-nowrap hover:bg-primary hover:text-white transition-colors">Scanning multiple pages</a>
          <a href="#limits" className="px-3 py-1 rounded-full bg-surface-container dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] whitespace-nowrap hover:bg-primary hover:text-white transition-colors">Limits</a>
          <a href="#accuracy" className="px-3 py-1 rounded-full bg-surface-container dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] whitespace-nowrap hover:bg-primary hover:text-white transition-colors">Accuracy</a>
          <a href="#privacy" className="px-3 py-1 rounded-full bg-surface-container dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] whitespace-nowrap hover:bg-primary hover:text-white transition-colors">Privacy</a>
          <a href="#glossary" className="px-3 py-1 rounded-full bg-surface-container dark:bg-[#111A2E] text-on-surface dark:text-[#E2E8F0] whitespace-nowrap hover:bg-primary hover:text-white transition-colors">Glossary</a>
        </nav>

        {/* SECTION 1: WHAT IT CHECKS */}
        <section id="what-it-checks" className="scroll-mt-24 space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-primary dark:bg-[#2DD4BF] inline-block" />
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface dark:text-[#E2E8F0]">What ClearClick checks</h2>
          </div>
          <p className="text-on-surface-variant dark:text-[#94A3B8] text-base leading-relaxed">
            ClearClick audits web interfaces against three specific categories described in dark pattern research (such as the taxonomy established by{' '}
            <a
              href="https://arxiv.org/abs/1907.07032v2"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary dark:text-[#2DD4BF] underline inline-flex items-center gap-0.5"
            >
              Mathur et al., 2019
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
            ). ClearClick flags designs that may influence or mislead people about costs, subscriptions, and personal consent.
          </p>

          {/* Sub-section: Hidden Charges */}
          <article id="hidden-charges" className="scroll-mt-28 p-5 sm:p-6 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-4">
            <h3 className="text-lg font-bold text-on-surface dark:text-[#E2E8F0]">Hidden charges and drip pricing</h3>
            <p className="text-sm sm:text-base text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
              Mandatory fees or surcharges that are omitted from earlier browsing stages and added solely at the final payment screen, or recurring billing terms disclosed only in faint, low-contrast microprint.
            </p>
            <div className="space-y-2">
              <span className="text-xs uppercase font-mono font-semibold text-on-surface-variant dark:text-[#94A3B8] block">
                Illustrative example, not from a real site:
              </span>
              <pre className="p-4 rounded-lg bg-surface-container dark:bg-[#0B1220] font-mono text-xs sm:text-sm text-on-surface dark:text-[#E2E8F0] overflow-x-auto leading-relaxed border border-outline-variant/20 dark:border-[#26324A]">
{`[CATALOG PRICE]  Hotel Room: $120.00 / night
[CHECKOUT TOTAL] Total Charged: $162.00
[UNADVERTISED]   +$42.00 ("Facility and resort levy")
[ELEMENT STYLE]  font-size: 10px; color: #9ca3af; display: block;`}
              </pre>
            </div>
          </article>

          {/* Sub-section: Cancellation Hurdles */}
          <article id="cancellation" className="scroll-mt-28 p-5 sm:p-6 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-4">
            <h3 className="text-lg font-bold text-on-surface dark:text-[#E2E8F0]">Cancellation hurdles</h3>
            <p className="text-sm sm:text-base text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
              Asymmetric friction where starting a recurring subscription takes a single click, but ending it requires navigating obscure sub-menus, enduring multi-step retention questionnaires, calling a telephone agent during limited business hours, or facing guilt-inducing refusal buttons.
            </p>
            <div className="space-y-2">
              <span className="text-xs uppercase font-mono font-semibold text-on-surface-variant dark:text-[#94A3B8] block">
                Illustrative example, not from a real site:
              </span>
              <pre className="p-4 rounded-lg bg-surface-container dark:bg-[#0B1220] font-mono text-xs sm:text-sm text-on-surface dark:text-[#E2E8F0] overflow-x-auto leading-relaxed border border-outline-variant/20 dark:border-[#26324A]">
{`[SIGNUP FLOW]    1 click (Apple Pay / Instant Checkout)
[CANCEL LINK]    Nested under: Settings -> Advanced -> Account Data -> Subscriptions -> Manage
[CONFIRM SHAME]  Button wording: "No thanks, I dislike saving money and want to lose my perks"
[ASYMMETRY]      Requires live phone call Monday-Thursday 9am-12pm`}
              </pre>
            </div>
          </article>

          {/* Sub-section: Consent */}
          <article id="consent" className="scroll-mt-28 p-5 sm:p-6 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-4">
            <h3 className="text-lg font-bold text-on-surface dark:text-[#E2E8F0]">One-sided consent choices</h3>
            <p className="text-sm sm:text-base text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
              Cookie and privacy dialogues designed to steer user agreement. Examples include pre-ticked checkboxes opting users into marketing, missing equal "Reject All" options on the first layer, confusing double-negative wording, or extreme visual disparity between accept and decline buttons.
            </p>
            <div className="space-y-2">
              <span className="text-xs uppercase font-mono font-semibold text-on-surface-variant dark:text-[#94A3B8] block">
                Illustrative example, not from a real site:
              </span>
              <pre className="p-4 rounded-lg bg-surface-container dark:bg-[#0B1220] font-mono text-xs sm:text-sm text-on-surface dark:text-[#E2E8F0] overflow-x-auto leading-relaxed border border-outline-variant/20 dark:border-[#26324A]">
{`[ACCEPT BUTTON]  bg: #005c55; text: #ffffff; size: 160x44px; contrast: 6.8:1
[REJECT BUTTON]  text: #b0b4b8 on #f7f9fb (contrast ratio: 1.98:1); size: 60x20px
[AREA RATIO]     Accept is 5.8x larger in surface area than Reject
[PRE-TICKED]     [x] "Send me promotional emails and share data with marketing partners"`}
              </pre>
            </div>
          </article>
        </section>

        {/* SECTION 2: HOW IT CHECKS */}
        <section id="how-it-checks" className="scroll-mt-24 space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-primary dark:text-[#2DD4BF] inline-block" />
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface dark:text-[#E2E8F0]">How it checks: Rules vs AI</h2>
          </div>
          <p className="text-on-surface-variant dark:text-[#94A3B8] text-base leading-relaxed">
            ClearClick uses a dual-layer inspection pipeline combining deterministic rule checks in Python with an optional AI verification step.
          </p>

          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-2">
              <h3 className="text-base font-bold text-on-surface dark:text-[#E2E8F0]">1. Deterministic Rule Engine</h3>
              <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
                Rules inspect the DOM tree, CSS styles, and bounding boxes extracted by Playwright. Rules check standard WCAG contrast ratios against element backgrounds, measure button surface area ratios ($\ge 1.8\times$), identify pre-ticked inputs, and match known syntactic patterns.
              </p>
              <p className="text-xs font-semibold text-primary dark:text-[#2DD4BF]">
                Rules give the same result for the same captured page every time.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-2">
              <h3 className="text-base font-bold text-on-surface dark:text-[#E2E8F0]">2. Optional AI Inspection (Gemini)</h3>
              <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
                When an API key is available and AI inspection is toggled on, ClearClick queries Google Gemini for subtle semantic cues (such as emotional guilt-tripping and complex double negatives).
              </p>
              <div className="p-3 bg-surface-container-low dark:bg-[#0B1220] rounded-lg text-xs text-on-surface dark:text-[#E2E8F0] space-y-1">
                <strong>Verbatim Quote & Element Guard:</strong> Every AI finding must return a verbatim quote that is verified against the specific extracted DOM element. If the quote cannot be verified in that element or is too short, the AI finding is dropped. Note that while deterministic rules are repeatable, they are heuristic and subject to potential false positives or misses.
              </div>
              <p className="text-xs text-on-surface-variant dark:text-[#94A3B8]">
                AI analysis can be toggled off at any time; if no key is configured, ClearClick operates seamlessly in rules-only mode.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION: SCANNING MULTIPLE PAGES */}
        <section id="multi-page-scanning" className="scroll-mt-24 space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-primary dark:bg-[#2DD4BF] inline-block" />
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface dark:text-[#E2E8F0]">Scanning multiple pages</h2>
          </div>
          <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-4 text-sm sm:text-base text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
            <p>
              Rather than crawling an entire website indiscriminately, ClearClick discovers and ranks the key pages where deceptive design typically clusters: pricing plans, cart review, checkout, account registration, cancellation, and consent dialogs.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="p-3 bg-surface-container-low dark:bg-[#0B1220] rounded-lg">
                <strong className="text-on-surface dark:text-[#E2E8F0] block mb-1">Targeted Discovery & Priority Ranking</strong>
                Discovers URLs via <code>robots.txt</code> sitemaps, <code>sitemap.xml</code>, and navigation links. Normalises paths, collapses near-duplicate templates, and prioritises transactional paths.
              </div>
              <div className="p-3 bg-surface-container-low dark:bg-[#0B1220] rounded-lg">
                <strong className="text-on-surface dark:text-[#E2E8F0] block mb-1">Strict Crawler Caps & Politeness</strong>
                Up to 8 pages analysed per site; AI analysis on at most 5 top-ranked pages. Concurrency is strictly 1 per domain with a polite 1.0s inter-request delay and full robots.txt respect.
              </div>
              <div className="p-3 bg-surface-container-low dark:bg-[#0B1220] rounded-lg">
                <strong className="text-on-surface dark:text-[#E2E8F0] block mb-1">Honest Block Detection</strong>
                Anti-bot challenges, CAPTCHAs, and HTTP 403/429/503 barriers are reported transparently as blocked—never bypassed or scored as clean. Blocked domains enter a 30-minute cooldown.
              </div>
              <div className="p-3 bg-surface-container-low dark:bg-[#0B1220] rounded-lg">
                <strong className="text-on-surface dark:text-[#E2E8F0] block mb-1">Session-Only In-Memory Storage</strong>
                Scan reports, discovered paths, and extracted DOM findings are kept in-memory for the active session and are not persisted in external databases.
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: LIMITS */}
        <section id="limits" className="scroll-mt-24 space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-primary dark:bg-[#2DD4BF] inline-block" />
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface dark:text-[#E2E8F0]">Known limits</h2>
          </div>
          <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-3">
            <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
              <li><strong>Three categories only:</strong> ClearClick is calibrated exclusively for hidden charges, cancellation hurdles, and consent manipulation. It does not check other patterns such as fake social proof or disguised search ads.</li>
              <li><strong>Partial coverage:</strong> Results cover only the pages reached. Skipping low-priority pages or blocked pages means unreached areas of a site were not checked; zero findings does not guarantee that the unreached portions of a domain are free from dark patterns.</li>
              <li><strong>Logins and interactions:</strong> The crawler cannot access content behind user authentication, payment credentials, or multi-step shopping funnels unless captured screenshots or saved HTML are directly uploaded.</li>
              <li><strong>AI variability:</strong> LLM responses can vary between runs, may misinterpret playful brand tone, or miss visual context.</li>
              <li><strong>"No findings" is not a clean bill of health:</strong> A page with zero findings may still contain deceptive practices that fall outside the three evaluated categories.</li>
              <li><strong>Not legal advice:</strong> ClearClick provides automated warnings for humans to review. It produces no legal conclusions.</li>
            </ul>
          </div>
        </section>

        {/* SECTION 4: ACCURACY */}
        <section id="accuracy" className="scroll-mt-24 space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-primary dark:bg-[#2DD4BF] inline-block" />
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface dark:text-[#E2E8F0]">Accuracy and evaluation</h2>
          </div>

          <p className="text-on-surface-variant dark:text-[#94A3B8] text-sm sm:text-base leading-relaxed">
            The numbers below are loaded directly from the evaluation benchmark (<code className="text-xs bg-surface-container dark:bg-[#0B1220] px-1 py-0.5 rounded">evaluation.json</code>) without headline inflation or hardcoded claims.
          </p>

          {evalData && evalData.categories && Object.keys(evalData.categories).length > 0 ? (
            <div className="space-y-6">
              {/* Dataset Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-surface-container-low dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A]">
                  <span className="text-xs text-on-surface-variant dark:text-[#94A3B8] block">Dev Set</span>
                  <span className="text-xl font-bold text-on-surface dark:text-[#E2E8F0]">{evalData.datasets?.dev ?? 0}</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A]">
                  <span className="text-xs text-on-surface-variant dark:text-[#94A3B8] block">Held-out Set</span>
                  <span className="text-xl font-bold text-on-surface dark:text-[#E2E8F0]">{evalData.datasets?.heldout ?? 0}</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A]">
                  <span className="text-xs text-on-surface-variant dark:text-[#94A3B8] block">Clean Controls</span>
                  <span className="text-xl font-bold text-on-surface dark:text-[#E2E8F0]">{evalData.datasets?.clean ?? 0}</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A]">
                  <span className="text-xs text-on-surface-variant dark:text-[#94A3B8] block">Held-out Source</span>
                  <span className="text-sm font-semibold text-on-surface dark:text-[#E2E8F0] uppercase tracking-wide">
                    {evalData.datasets?.heldout_source ?? 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Category Performance Table */}
              <div className="rounded-xl border border-outline-variant/30 dark:border-[#26324A] overflow-hidden bg-surface-container-lowest dark:bg-[#111A2E]">
                <div className="p-3 bg-surface-container-low dark:bg-[#0B1220] border-b border-outline-variant/30 dark:border-[#26324A] font-semibold text-xs text-on-surface dark:text-[#E2E8F0]">
                  Held-Out Evaluation by Category (Rules-Only vs Rules+AI)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/20 dark:border-[#26324A] text-on-surface-variant dark:text-[#94A3B8]">
                        <th className="p-3 font-semibold">Category</th>
                        <th className="p-3 font-semibold">Rules Precision</th>
                        <th className="p-3 font-semibold">Rules Recall</th>
                        <th className="p-3 font-semibold">Counts (TP/FP/FN)</th>
                        <th className="p-3 font-semibold">Rules + AI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20 dark:divide-[#26324A]">
                      {Object.entries(evalData.categories || {}).map(([key, cat]: [string, any]) => (
                        <tr key={key} className="hover:bg-surface-container-low/50 dark:hover:bg-[#0B1220]/50">
                          <td className="p-3 font-medium capitalize text-on-surface dark:text-[#E2E8F0]">
                            {key.replace('_', ' ')}
                          </td>
                          <td className="p-3 font-mono text-on-surface dark:text-[#E2E8F0]">
                            {cat.rules ? `${(cat.rules.precision * 100).toFixed(1)}%` : '—'}
                          </td>
                          <td className="p-3 font-mono text-on-surface dark:text-[#E2E8F0]">
                            {cat.rules ? `${(cat.rules.recall * 100).toFixed(1)}%` : '—'}
                          </td>
                          <td className="p-3 font-mono text-xs text-on-surface-variant dark:text-[#94A3B8]">
                            TP: {cat.rules?.tp ?? 0} / FP: {cat.rules?.fp ?? 0} / FN: {cat.rules?.fn ?? 0}
                          </td>
                          <td className="p-3 text-on-surface-variant dark:text-[#94A3B8]">
                            {cat.rules_ai ? `${(cat.rules_ai.precision * 100).toFixed(1)}% / ${(cat.rules_ai.recall * 100).toFixed(1)}%` : 'AI analysis not evaluated'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Failures List */}
              {evalData.failures && evalData.failures.length > 0 && (
                <div className="p-4 rounded-xl bg-surface-container-low dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-2">
                  <h4 className="text-xs uppercase font-semibold text-on-surface dark:text-[#E2E8F0] tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-caution" aria-hidden="true" />
                    <span>Known Failures on Held-Out Test Set ({evalData.failures.length})</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-on-surface-variant dark:text-[#94A3B8]">
                    {evalData.failures.map((f: any, i: number) => (
                      <li key={i} className="font-mono">
                        <strong className="text-on-surface dark:text-[#E2E8F0]">{f.title}:</strong> {f.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] text-center text-sm text-on-surface-variant dark:text-[#94A3B8]">
              No evaluation results yet. Run the benchmark suite to generate evaluation metrics.
            </div>
          )}

          <div className="p-3 rounded-lg bg-surface-container dark:bg-[#0B1220] border border-outline-variant/20 dark:border-[#26324A] text-xs text-on-surface-variant dark:text-[#94A3B8] italic">
            Results on test pages do not guarantee the same accuracy on every real website.
          </div>
        </section>

        {/* SECTION 5: PRIVACY */}
        <section id="privacy" className="scroll-mt-24 space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-primary dark:bg-[#2DD4BF] inline-block" />
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface dark:text-[#E2E8F0]">Privacy and data handling</h2>
          </div>
          <div className="p-5 rounded-xl bg-surface-container-lowest dark:bg-[#111A2E] border border-outline-variant/30 dark:border-[#26324A] space-y-4">
            <p className="text-sm sm:text-base text-on-surface-variant dark:text-[#94A3B8] leading-relaxed">
              ClearClick inspects pages in real time during your active browser session:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-on-surface-variant dark:text-[#94A3B8]">
              <li><strong>Zero User Profiles:</strong> No accounts, passwords, or personal profiles are created.</li>
              <li><strong>Ephemeral Screenshot Storage:</strong> Captured screenshots are stored ephemerally in server scratch memory during analysis and are not retained long-term.</li>
              <li><strong>No Third-Party Tracker Cookies:</strong> ClearClick runs with zero tracking scripts or analytics beacons.</li>
            </ul>

            {privacyConfig.aiTier === 'free' && (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong>Notice on AI Provider:</strong> AI analysis uses a free-tier API ({privacyConfig.provider}). The provider's terms may allow submitted content to be used to improve its products, so do not analyse pages or screenshots containing private information.
              </div>
            )}
          </div>
        </section>

        {/* SECTION 6: GLOSSARY */}
        <section id="glossary" className="scroll-mt-24 space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-primary dark:bg-[#2DD4BF] inline-block" />
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface dark:text-[#E2E8F0]">Glossary of terms</h2>
          </div>
          <div className="divide-y divide-outline-variant/20 dark:divide-[#26324A] rounded-xl border border-outline-variant/30 dark:border-[#26324A] bg-surface-container-lowest dark:bg-[#111A2E] p-4 sm:p-6 space-y-4">
            <div className="pt-2">
              <h3 className="font-bold text-sm text-on-surface dark:text-[#E2E8F0]">Dark pattern</h3>
              <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] mt-1 leading-relaxed">
                A user interface design crafted to influence or manipulate users into taking actions they might not otherwise choose.
              </p>
            </div>

            <div className="pt-4">
              <h3 className="font-bold text-sm text-on-surface dark:text-[#E2E8F0]">Pre-ticked box</h3>
              <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] mt-1 leading-relaxed">
                A form checkbox that is selected by default before the user interacts with it, often opting them into marketing or extra recurring services.
              </p>
            </div>

            <div className="pt-4">
              <h3 className="font-bold text-sm text-on-surface dark:text-[#E2E8F0]">Drip pricing</h3>
              <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] mt-1 leading-relaxed">
                Incrementally revealing unavoidable mandatory fees as the user progresses through checkout, making the initial advertised price lower than the final cost.
              </p>
            </div>

            <div className="pt-4">
              <h3 className="font-bold text-sm text-on-surface dark:text-[#E2E8F0]">Confirm-shaming</h3>
              <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] mt-1 leading-relaxed">
                Framing the option to decline an offer with emotionally manipulative or guilt-inducing wording.
              </p>
            </div>

            <div className="pt-4">
              <h3 className="font-bold text-sm text-on-surface dark:text-[#E2E8F0]">Asymmetric choice</h3>
              <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] mt-1 leading-relaxed">
                Designing an interface where the option preferred by the provider is visually prominent and easy to select, while the alternative is subdued, buried, or requires multiple extra steps.
              </p>
            </div>

            <div className="pt-4">
              <h3 className="font-bold text-sm text-on-surface dark:text-[#E2E8F0]">Double negative</h3>
              <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] mt-1 leading-relaxed">
                Phrasing settings with two negative words (e.g., "Do not uncheck if you wish not to receive updates"), confusing users about what checking the box does.
              </p>
            </div>

            <div className="pt-4">
              <h3 className="font-bold text-sm text-on-surface dark:text-[#E2E8F0]">First layer</h3>
              <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] mt-1 leading-relaxed">
                The initial interface banner or dialog presented to the user before they click into secondary settings or granular options.
              </p>
            </div>

            <div className="pt-4">
              <h3 className="font-bold text-sm text-on-surface dark:text-[#E2E8F0]">Contrast ratio</h3>
              <p className="text-sm text-on-surface-variant dark:text-[#94A3B8] mt-1 leading-relaxed">
                The measured luminance difference between text and its background color. Ratios below 4.5:1 make text difficult to read under standard accessibility guidelines.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Sticky "On this page" TOC for screens >= 1024px */}
      <aside aria-label="On this page navigation" className="hidden lg:block sticky top-20 space-y-3 p-4 bg-surface-container-low dark:bg-[#111A2E] rounded-xl border border-outline-variant/30 dark:border-[#26324A] text-xs">
        <h3 className="uppercase font-bold text-on-surface-variant dark:text-[#94A3B8] tracking-wider text-xs">
          On this page
        </h3>
        <ul className="space-y-1.5 font-medium">
          <li>
            <a href="#what-it-checks" className="text-on-surface dark:text-[#E2E8F0] hover:text-primary dark:hover:text-[#2DD4BF] block py-0.5 transition-colors">
              What it checks
            </a>
            <ul className="pl-2 space-y-1 mt-1 text-on-surface-variant dark:text-[#94A3B8]">
              <li><a href="#hidden-charges" className="hover:underline block">Hidden charges</a></li>
              <li><a href="#cancellation" className="hover:underline block">Cancellation</a></li>
              <li><a href="#consent" className="hover:underline block">Consent</a></li>
            </ul>
          </li>
          <li className="pt-1">
            <a href="#how-it-checks" className="text-on-surface dark:text-[#E2E8F0] hover:text-primary dark:hover:text-[#2DD4BF] block py-0.5 transition-colors">
              How it checks
            </a>
          </li>
          <li>
            <a href="#multi-page-scanning" className="text-on-surface dark:text-[#E2E8F0] hover:text-primary dark:hover:text-[#2DD4BF] block py-0.5 transition-colors">
              Scanning multiple pages
            </a>
          </li>
          <li>
            <a href="#limits" className="text-on-surface dark:text-[#E2E8F0] hover:text-primary dark:hover:text-[#2DD4BF] block py-0.5 transition-colors">
              Known limits
            </a>
          </li>
          <li>
            <a href="#accuracy" className="text-on-surface dark:text-[#E2E8F0] hover:text-primary dark:hover:text-[#2DD4BF] block py-0.5 transition-colors">
              Accuracy & evaluation
            </a>
          </li>
          <li>
            <a href="#privacy" className="text-on-surface dark:text-[#E2E8F0] hover:text-primary dark:hover:text-[#2DD4BF] block py-0.5 transition-colors">
              Privacy & data
            </a>
          </li>
          <li>
            <a href="#glossary" className="text-on-surface dark:text-[#E2E8F0] hover:text-primary dark:hover:text-[#2DD4BF] block py-0.5 transition-colors">
              Glossary
            </a>
          </li>
        </ul>
      </aside>
    </div>
  );
};
