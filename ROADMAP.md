# ClearClick AI — Honest Implementation Roadmap

## Current Baseline: `v0` (Frozen & Audited)

- [x] **Phase A: Freeze and Audit**
  - [x] Tag existing state `v0` in Git
  - [x] Comprehensive code audit identifying hardcoded strings, stubs, and untested areas
  - [x] Update `PROJECT.md` and `ROADMAP.md` with honest scope and phase gates

- [x] **Phase B: Rebuild Evaluation (Before Modifying Detectors)**
  - [x] Split corpus into **dev set** (25 cases) and **held-out test set** (16 cases)
  - [x] Expand corpus to 41 total examples with 18 clean controls, including tricky cleans
  - [x] Established strict rule: AI / scripts may never edit held-out corpus or labels
  - [x] Recorded authentic baseline on held-out test set: **Precision 83.3%**, **Recall 55.6%**, with full list of honest failures

- [x] **Phase C: Make Detectors Honest (Ralph Loop on Dev Set Only)**
  - [x] Remove hardcoded fixture strings (e.g. `resort fee`, specific fee phrases, hardcoded confirm-shaming strings)
  - [x] Implement multi-step flow input (ordered sequence of steps for true step counting and cross-step price tracking in `FlowData`)
  - [x] Real double-negative detection logic (linguistic patterns for negation prefixes and double toggle/checkbox states)
  - [x] Contextual contrast checking (walk DOM parent tree for true background color, support dark themes)
  - [x] Results: Dev Set 100% Precision / 100% Recall; Held-out Test Set 90.0% Precision / 100.0% Recall (TP=9, FP=1, FN=0)

- [x] **Phase D: Real AI Layer & Vision**
  - [x] Full Claude/Gemini text prompt returning structured JSON with verbatim quotes
  - [x] Implement `vision_analysis.py` for visual dominance & prominence
  - [x] Robust quote verifier (curly quotes, whitespace normalization, min-length >= 12 chars requirement)
  - [x] Explicit UI indicator: `"AI analysis not run"` when key is missing or call fails
  - [x] Separate reporting for rules-only vs. rules+AI in benchmark and UI
  - [x] 22/22 unit tests passing including mock API calls, quote validation, and failure tracking

- [ ] **Phase E: Real-World Extraction Robustness**
  - [ ] Handle iframes and shadow DOM (cookie banners like OneTrust)
  - [ ] Dynamic wait conditions for late-loading elements
  - [ ] Screen scaling (DPR) coordinate correction for highlight boxes
  - [ ] Test on 10 external real-world pages

- [ ] **Phase F: Security & Hygiene**
  - [ ] URL SSRF protection (block localhost, private subnets, cloud metadata IPs)
  - [ ] Request timeouts, page size limits, rate limits
  - [ ] Ephemeral screenshot storage (auto-cleanup after analysis)

- [ ] **Phase G: Honest Reporting UI**
  - [ ] Remove artificial "100%" claims from UI
  - [ ] Show test set size, failures, and rule vs. AI source distinction
  - [ ] Remove hardcoded confidence numbers or ground them in measurable metrics

- [ ] **Phase H: Process & Phase Verification**
  - [ ] One Git commit per phase
  - [ ] User review gate at the conclusion of every phase before executing the next
