# Ralph Loop Task Specification

Read `PROJECT.md` and `ROADMAP.md`.

## Task:
Pass all detector unit tests in `tests/` and maintain 100% adherence to the ground-truth corpus labels in `corpus/labels.json`.

## Rules:
1. Detectors may only analyze structured input extracted from the page (text, checkboxes, buttons, computed styles, bounding boxes); never initiate unsolicited outbound network calls during detection.
2. Every emitted finding MUST strictly follow the unified JSON finding format:
   - `category`: "hidden_charges" | "cancellation" | "consent"
   - `type`: machine identifier string
   - `severity`: "low" | "medium" | "high"
   - `confidence`: float between 0.0 and 1.0
   - `evidence`: exact string quote or measured metric value
   - `bbox`: [x, y, width, height]
   - `why`: plain-language, non-accusatory explanation of how this may mislead
   - `safer_alternative`: concrete fairer design recommendation
   - `source`: "rule" | "ai"
3. Never relax, edit, or delete test assertions or `corpus/labels.json` to make tests pass.
4. If quote verification fails (the AI quote does not appear verbatim in DOM visible text), drop the finding immediately.
5. All rule detectors must run deterministically with sub-millisecond overhead.
