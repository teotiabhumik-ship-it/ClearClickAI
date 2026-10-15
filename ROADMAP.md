# ClearClick AI — Implementation Roadmap

- [x] **Phase 0: Spec, Planning & Ground-Truth Test Corpus**
  - [x] Create `PROJECT.md`, `ROADMAP.md`, `PROMPT.md`
  - [x] Generate 14 labelled HTML test fixtures across 3 focus categories (positive & negative clean controls)
  - [x] Create `corpus/labels.json` with ground truth pattern types, targets, and annotations

- [x] **Phase 1: End-to-End Application Skeleton**
  - [x] Standardized finding schema (`schema.py`)
  - [x] FastAPI backend with analysis endpoints and mock responses
  - [x] Modern React + Vite frontend skeleton with interactive visualizer layout

- [x] **Phase 2: Playwright Extraction Engine**
  - [x] Headless Chromium extraction for DOM checkboxes, buttons, links, price texts, and bboxes
  - [x] Computed styles and WCAG 2.1 color contrast calculation engine
  - [x] Screenshot generation and element coordinate mapping

- [x] **Phase 3: Deterministic Rule-Based Detectors**
  - [x] Manipulative Consent detector (`preticked_consent`, `unequal_button_emphasis`, `missing_reject`)
  - [x] Hidden Charges detector (`microprint_fee`, `low_contrast_fee`, `late_appearing_charge`)
  - [x] Misleading Cancellation detector (`asymmetric_step_count`, `buried_cancel_link`)
  - [x] Unit tests for each detector category passing deterministically (15/15 tests passing)

- [x] **Phase 4: AI Detectors with Anti-Hallucination Guard**
  - [x] Structured LLM prompt adapter for text analysis (confirm-shaming, double negatives)
  - [x] Strict DOM quote verification engine (filters out any hallucinated quotes)
  - [x] Modular support for Claude, Gemini, and heuristic fallback

- [x] **Phase 5: Findings Aggregator & Interactive Report UI**
  - [x] Unified finding consolidation, deduplication, and confidence scoring
  - [x] Interactive React screenshot canvas with clickable/hoverable SVG bounding boxes
  - [x] Categorized findings drawer with evidence, explanations, and fair design suggestions
  - [x] Non-accusatory disclaimers and category breakdowns

- [x] **Phase 6: Evaluation & Benchmarking Suite**
  - [x] Automated benchmark script evaluating precision, recall, FP and FN rates over the corpus
  - [x] Separate scorecard for rule-based vs. AI detectors
  - [x] Benchmark dashboard view in the frontend UI
