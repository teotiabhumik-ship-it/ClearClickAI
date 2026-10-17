# ClearClick AI — Dark Pattern Detection & Fair Design Advisor

ClearClick AI is an evidence-based audit tool that inspects web pages (DOM elements, styles, computed contrast, bounding boxes, and interaction flows) to flag manipulative design practices (dark patterns) across three focus areas:
1. **Manipulative Consent**: Pre-ticked marketing checkboxes, asymmetric button weights (vibrant "Accept All" vs faint/greyed "Reject"), missing first-layer reject options, and confusing double negatives.
2. **Hidden Charges**: Compulsory fees hidden in micro-print font, low-contrast fee disclosures failing WCAG standards, and late-appearing drip charges.
3. **Misleading Cancellation**: Buried cancellation links in fine print, confirm-shaming emotional manipulation, and asymmetric multi-step cancellation hurdles.

---

## Three Core Engineering Principles
1. **Evidence, not accusations**: Every finding provides concrete proof (exact verbatim quotes, measured WCAG contrast ratios, element coordinates `[x, y, w, h]`) and cautious phrasing ("potentially misleading", never legal accusations like "fraud").
2. **Rules where possible, AI where needed**: Exact DOM and style measurements are computed via deterministic Python rule engines; nuanced copy and visual hierarchy are evaluated via AI detectors equipped with element-grounded verbatim quote verification. Deterministic rules are repeatable and structured, but heuristic and subject to false positives or misses; AI findings are tied to extracted DOM elements to mitigate hallucination.
3. **Honest measurement**: Includes an automated benchmark evaluation suite that assesses precision and recall against a ground-truth corpus.

---

## Quickstart

### 1. Launch the Full Application (Single Command)
Run the FastAPI backend which simultaneously serves the REST API and the compiled React frontend:
```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
Open your browser at **[http://localhost:8000](http://localhost:8000)**.

### 2. Run the Detector Unit Tests
```bash
python -m pytest tests/ -v
```
All 42 automated tests pass deterministically.

### 3. Run the Ground-Truth Benchmark Evaluation
```bash
python -m backend.app.evaluation.benchmark
```
Computes True Positives, False Positives, False Negatives, Precision, Recall, and F1 score across all positive fixtures and negative clean controls.

### 4. Optional: Run Frontend in Vite Dev Mode
```bash
cd frontend
npm run dev
```
Vite will start on `http://localhost:3000` with instant proxy forwarding to the backend on `:8000`.

---

## Deployment & Web Host Notes

### Running on a Static Web Host (GitHub Pages / Vercel)
If you deploy only the frontend to a static host (like GitHub Pages or Vercel static):
- **Ground-Truth Sample Cases**: Work out of the box! All 14 ground-truth sample audits, proofreader annotations, and WCAG contrast measurements are bundled directly with the frontend.
- **Live URL Scanning**: Inspecting arbitrary external websites requires browser automation (Playwright + FastAPI). Because static web hosts cannot execute Python or run headless browsers, live URL requests must point to a running backend.
- **Connecting a Backend**: Click the **Server Settings** icon in the top header (or on the error alert) to point your web frontend to your hosted backend URL (e.g., `https://your-backend.onrender.com`).

### 1-Click Cloud Deployment (Render / Docker)
ClearClick AI includes a multi-stage `Dockerfile` and `render.yaml`:
1. Connect your GitHub repository to [Render.com](https://render.com).
2. Create a new **Web Service** from your repository (select **Docker** runtime).
3. Set the environment variable `PORT=8000`.
4. Render will automatically build the frontend, install Playwright Chromium, and serve the full application at your public `https://<service-name>.onrender.com` URL.

---

## Ground-Truth Corpus Catalog (`corpus/`)
The repository contains 14 synthetic test fixtures and `labels.json`:
- **Positive (Dark Pattern Fixtures)**:
  - `consent_preticked.html`: Pre-ticked promotional and 3rd party sharing checkboxes.
  - `consent_asymmetric_buttons.html`: Prominent green Accept vs faint grey Reject link.
  - `consent_missing_reject.html`: Banner omitting direct reject choice on layer 1.
  - `consent_double_negative.html`: Deceptive double-negative phrasing.
  - `charges_microprint_fee.html`: Mandatory fees rendered in 8px microprint font.
  - `charges_low_contrast_fee.html`: Mandatory surcharge rendered in 1.3:1 contrast.
  - `charges_drip_pricing.html`: Price jump from $45 to $76.55 on final step.
  - `cancel_buried_link.html`: Cancellation link hidden in 10px footer text.
  - `cancel_confirm_shaming.html`: Confirm-shaming button text ("I hate saving money").
  - `cancel_asymmetric_flow.html`: Multi-step (Step 4 of 6) cancellation hurdle.
- **Negative (Clean Fair Controls)**:
  - `consent_equal_choice.html`: Symmetrical Accept and Reject buttons.
  - `consent_unchecked_optin.html`: Unticked opt-in checkboxes.
  - `charges_transparent_pricing.html`: Upfront all-inclusive fee disclosure.
  - `cancel_one_click.html`: Legible, direct one-click cancellation.

---

## Project Structure
```text
clearclick-ai/
├── PROJECT.md                # GSD Project Specification & boundaries
├── ROADMAP.md                # Phase-by-phase tracker and progress status
├── PROMPT.md                 # Ralph loop task specification
├── .env.example              # Environment variables template
├── corpus/                   # Labelled ground-truth test corpus
│   ├── positive/             # Synthetic HTML fixtures demonstrating dark patterns
│   ├── negative/             # Clean HTML fixtures (fair design benchmarks)
│   └── labels.json           # Ground truth annotations
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI entrypoint & REST endpoints
│   │   ├── schema.py         # Standard Pydantic schemas (Finding, PageData)
│   │   ├── config/
│   │   │   ├── settings.py   # Configurable models, providers, rate limits
│   │   │   └── thresholds.py # Centralized detector thresholds & severity map
│   │   ├── extract/
│   │   │   ├── playwright_extractor.py # DOM, style & screenshot extractor
│   │   │   └── contrast.py   # WCAG 2.1 contrast calculation
│   │   ├── detectors/
│   │   │   ├── base.py       # Base detector protocol
│   │   │   ├── consent.py    # Consent detector rules
│   │   │   ├── hidden_charges.py # Microprint & low contrast fee rules
│   │   │   ├── cancellation.py   # Buried links & confirm-shaming rules
│   │   │   └── flow_analysis.py  # Multi-step flow price and friction comparison
│   │   ├── ai/
│   │   │   ├── client.py     # Modular LLM client (Claude, Gemini, caching, limits)
│   │   │   ├── text_analysis.py # Linguistic pattern detector
│   │   │   ├── vision_analysis.py # Visual asymmetry detector with fact checks
│   │   │   └── quote_verifier.py # Element-grounded verbatim quote verifier
│   │   └── evaluation/
│   │       └── benchmark.py  # Precision/recall benchmark evaluator
├── frontend/                 # React 18 + Vite + Tailwind CSS UI
│   ├── src/
│   │   ├── components/
│   │   │   ├── InputForm.tsx        # Preset & URL/HTML input
│   │   │   ├── ScreenshotViewer.tsx # Interactive SVG bounding box canvas
│   │   │   ├── FindingsPanel.tsx    # Finding cards & safer alternatives
│   │   │   └── EvaluationModal.tsx  # Benchmark scorecard modal
└── tests/                    # Pytest test suite (42+ automated tests)
```
