# ClearClick AI — Project Specification & Honest Scope

## 1. Goal
ClearClick AI inspects web pages and multi-step user flows (text, screenshots, DOM elements, and interaction sequences) to detect and flag potentially misleading dark patterns across three focus areas:
1. **Hidden Charges**: Late-appearing fees, micro-print price exclusions, and low-contrast fee disclosures.
2. **Misleading Cancellation**: Multi-step cancellation mazes (asymmetric friction compared to signup), buried cancellation links, and confirm-shaming copy.
3. **Manipulative Consent**: Pre-ticked consent checkboxes, asymmetric button prominence in cookie banners, and deceptive double-negative language.

## 2. Core Non-Negotiable Rules
- **Evidence, Not Accusations**: Findings must provide verbatim quotes, measured WCAG contrast values, or step counts. All descriptions use cautious phrasing ("potentially misleading"), never accusations like "fraud".
- **Rules Where Possible, AI Where Needed**: Deterministic rules govern exact, measurable attributes (checkbox states, contrast, font sizes, step counts). AI is strictly used for linguistic pressure and visual hierarchy judgment.
- **Honest Measurement**:
  - The model and detectors are evaluated on a **held-out test set** that detectors are NEVER tuned to or trained on.
  - Zero-failure results on self-authored tests are treated as warning signs of overfitting, not achievements.
  - Failures and false positives must be documented honestly.
  - If an AI API key is not present, the system MUST state explicitly: `"AI analysis not run"`.

## 3. Engineering Boundaries & Safety
- **No SSRF**: Outbound URLs must be strictly validated (only public http/https, blocking `localhost`, `127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.169.254`).
- **No Corpus Tampering**: Code/agent may NEVER edit the held-out corpus or its labels to pass tests.
- **Phase Verification Gates**: Every phase must be reviewed and approved before moving to the next phase.
