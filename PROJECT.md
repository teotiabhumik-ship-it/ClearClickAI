# ClearClick AI — Project Specification

## 1. Goal
ClearClick AI inspects web pages and user flows (their DOM text, rendered screenshots, computed styles, and interaction steps) to detect and flag potentially manipulative design choices (dark patterns) that subtly steer users into unintended actions. It provides concrete, evidence-based visual highlights, explains why the pattern may mislead the user, and presents fairer, user-centric alternative designs.

## 2. Focus Areas & Finding Criteria
The prototype focuses strictly on three distinct categories:

1. **Hidden Charges**:
   - Fees or costs introduced late in checkout flows without upfront disclosure.
   - Price disclosures rendered in micro-print (font size significantly smaller than baseline) or low visual contrast against the background (failing WCAG standards).
   - Pre-selected add-ons or bundled charges where the base product total is obscured.

2. **Misleading Cancellation**:
   - Asymmetric friction: cancellation processes requiring substantially more steps, interactions, or hurdles than subscription signup.
   - De-emphasized or hidden cancellation links (e.g. tiny font, low contrast, buried behind multiple non-intuitive sub-menus).
   - Confirm-shaming or guilt-inducing retention dialogues ("No thanks, I hate saving money").

3. **Manipulative Consent**:
   - Pre-ticked consent/marketing checkboxes (opt-out instead of opt-in).
   - Asymmetric visual emphasis on cookie banners (e.g. vibrant, high-contrast "Accept All" button beside an invisible, greyed-out, or missing "Reject" option).
   - Confusing double negatives and ambiguous language designed to trick users into giving consent.

## 3. Core Principles
- **Evidence, Not Accusations**: Every finding must include concrete proof—an exact text quote, measured contrast ratio, font size comparison, or bounding box coordinates. Findings are always characterized neutrally as "potentially misleading" or "de-emphasized", never as "fraud" or "scam".
- **Rules Where Possible, AI Where Needed**: Deterministic rules govern exact, measurable attributes (checkbox state, contrast calculations, font sizes, step counters). AI is employed strictly for linguistic nuance and visual hierarchy judgment.
- **Honest Measurement**: The system measures and reports its own performance (true positives, false positives, false negatives, precision, and recall) against a ground-truth corpus.

## 4. Out of Scope
- Detecting unrelated dark pattern categories (e.g. fake countdown timers, artificial scarcity tickers, forced social logins).
- Live browser extension or automated multi-domain web crawler.
- Legal determinations or compliance certification.
