// Vercel Serverless Function for Multi-Page Site Scanning
// Provides serverless page discovery, keyword ranking, block detection, and coverage reporting.

interface Finding {
  category: 'consent' | 'hidden_charges' | 'cancellation';
  type: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  evidence: string;
  bbox: [number, number, number, number];
  why: string;
  safer_alternative: string;
  source: 'rule' | 'ai' | 'hybrid';
}

interface ScanPage {
  url: string;
  page_type: 'pricing' | 'cart' | 'checkout' | 'signup' | 'account' | 'cancel' | 'consent' | 'other';
  page_status: 'ok' | 'blocked' | 'needs_login' | 'empty' | 'timeout' | 'robots_disallowed' | 'invalid_url' | 'error';
  status_reason: string;
  decision: 'will_analyse' | 'skipped_low_priority' | 'skipped_duplicate' | 'skipped_robots' | 'skipped_cap';
  skipped_reason?: 'skipped_low_priority' | 'skipped_duplicate' | 'skipped_robots' | 'skipped_cap' | 'skipped_blocked_domain' | null;
  score: number;
  evidence: string;
  depth: number;
  page_title: string | null;
  screenshot_base64: string | null;
  findings: Finding[];
  ai_status: string;
  ai_status_message: string;
}

interface GroupedFinding {
  category: 'consent' | 'hidden_charges' | 'cancellation';
  type: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  evidence: string;
  why: string;
  safer_alternative: string;
  source: 'rule' | 'ai' | 'hybrid';
  element_fingerprint: string;
  pages: string[];
  page_types: string[];
  sample_bbox: [number, number, number, number];
}

interface Coverage {
  pages_discovered: number;
  pages_analysed: number;
  pages_skipped_by_reason: Record<string, number>;
  pages_blocked: number;
  pages_needs_login: number;
  pages_ai_analysed: number;
  ai_calls_used: number;
  key_page_types_found: string[];
  key_page_types_reached: string[];
}

interface Scan {
  scan_id: string;
  root_url: string;
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
  created_at: string;
  completed_at: string | null;
  config_snapshot: Record<string, any>;
  pages: ScanPage[];
  grouped_findings: GroupedFinding[];
  coverage: Coverage;
  error_message: string | null;
}

// In-memory cache for scans within Vercel serverless lifecycle
const scansCache: Map<string, Scan> = ((globalThis as any).__clearclick_scans =
  (globalThis as any).__clearclick_scans || new Map<string, Scan>());

function isPrivateIpOrHost(hostname: string): boolean {
  if (['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'].includes(hostname)) {
    return true;
  }
  const parts = hostname.split('.').map(Number);
  if (parts.length === 4 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  return false;
}

function detectDarkPatterns(html: string): Finding[] {
  const findings: Finding[] = [];
  const cleanText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // 1. Preticked consent checkbox
  const pretickedRegex = /<input[^>]+type=["']?checkbox["']?[^>]*checked[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pretickedRegex.exec(html)) !== null) {
    const snippet = match[0];
    const startIdx = Math.max(0, match.index - 150);
    const endIdx = Math.min(html.length, match.index + snippet.length + 150);
    const contextText = html.slice(startIdx, endIdx).replace(/<[^>]+>/g, ' ');

    if (/(marketing|promotional|newsletter|partner|offers|third[- ]party|advertising|share.*profile)/i.test(contextText)) {
      findings.push({
        category: 'consent',
        type: 'preticked_consent',
        severity: 'medium',
        confidence: 0.92,
        evidence: contextText.trim().slice(0, 180),
        bbox: [40, 220, 16, 16],
        why: 'This marketing or tracking checkbox is pre-selected by default, enrolling the user without affirmative choice.',
        safer_alternative: 'Provide an un-ticked checkbox requiring explicit, affirmative opt-in by the user.',
        source: 'rule',
      });
      break;
    }
  }

  // 2. Double negative language
  const doubleNegMatch = cleanText.match(/(do\s+not\s+wish\s+to\s+not\s+receive|uncheck\s+if\s+you\s+do\s+not\s+want|opt-out\s+of\s+not\s+receiving)/i);
  if (doubleNegMatch) {
    findings.push({
      category: 'consent',
      type: 'double_negative_language',
      severity: 'high',
      confidence: 0.95,
      evidence: doubleNegMatch[0],
      bbox: [50, 280, 240, 24],
      why: 'Confusing double-negative phrasing intentionally impairs user comprehension of consent opt-outs.',
      safer_alternative: 'Use clear, affirmative phrasing such as "Check to receive updates".',
      source: 'rule',
    });
  }

  // 3. Cookie banner asymmetric choice
  if (/(cookie|privacy\s+preference|tracking)/i.test(cleanText)) {
    const hasAccept = /(accept\s+all|agree\s+to\s+all|allow\s+all)/i.test(html);
    const hasReject = /(reject(\s+all)?|refuse(\s+all)?|decline(\s+all)?|only\s+necessary|strictly\s+necessary|necessary\s+only|essential\s+only|use\s+necessary(\s+cookies)?|don'?t\s+accept)/i.test(html);
    const hasPreferences = /(manage\s+preferences|cookie\s+settings|more\s+options)/i.test(html);

    if (hasAccept && !hasReject && hasPreferences) {
      findings.push({
        category: 'consent',
        type: 'missing_reject_option',
        severity: 'medium',
        confidence: 0.9,
        evidence: 'Cookie banner provides "Accept All" and "Manage Preferences" without an equivalent direct first-layer Reject button.',
        bbox: [60, 320, 200, 36],
        why: 'The first layer of this consent banner lacks an equivalent, direct "Reject All" button, requiring extra friction to decline.',
        safer_alternative: 'Provide an equal-prominence "Reject All" button on the first layer.',
        source: 'rule',
      });
    }
  }

  // 4. Microprint fee or drip pricing
  const microMatch = html.match(/<(?:span|p|small|div|em|strong)[^>]*style=["'][^"']*font-size\s*:\s*([6-9]|10|11)px[^"']*["'][^>]*>([^<]*(?:fee|surcharge|charge|mandatory|resort)[^<]*)</i);
  if (microMatch) {
    findings.push({
      category: 'hidden_charges',
      type: 'microprint_fee',
      severity: 'high',
      confidence: 0.91,
      evidence: microMatch[0].replace(/<[^>]+>/g, ' ').trim().slice(0, 160),
      bbox: [40, 400, 280, 20],
      why: 'Mandatory pricing terms or fee disclosures are relegated to microprint typography, reducing transparency.',
      safer_alternative: 'Render all mandatory fee disclosures in standard body font (at least 14px).',
      source: 'rule',
    });
  }

  // 5. Confirm shaming
  const shamingMatch = cleanText.match(/(hate\s+saving\s+money|don'?t\s+want\s+discounts|prefer\s+paying\s+full|no\s+thanks.*hate|no\s+thanks.*give\s+up|no\s+thanks.*pay\s+more)/i);
  if (shamingMatch) {
    findings.push({
      category: 'cancellation',
      type: 'confirm_shaming',
      severity: 'high',
      confidence: 0.94,
      evidence: shamingMatch[0],
      bbox: [60, 480, 220, 32],
      why: 'The opt-out control uses emotionally manipulative phrasing to induce guilt in users exercising their choice.',
      safer_alternative: 'Provide neutral language such as "No thank you" or "Decline offer".',
      source: 'rule',
    });
  }

  // 6. Buried cancel link
  const buriedMatch = html.match(/(cancel\s+subscription|delete\s+account|end\s+membership)[^<]{0,40}(?:font-size\s*:\s*(?:8|9|10)px|color\s*:\s*#(?:888|999|aaa|bbb|ccc))/i);
  if (buriedMatch) {
    findings.push({
      category: 'cancellation',
      type: 'buried_link',
      severity: 'medium',
      confidence: 0.89,
      evidence: buriedMatch[0].replace(/<[^>]+>/g, ' ').trim().slice(0, 140),
      bbox: [40, 520, 180, 20],
      why: 'The cancellation link is concealed in reduced font size and faint coloration.',
      safer_alternative: 'Position the cancellation option in standard font within main account settings.',
      source: 'rule',
    });
  }

  return findings;
}

function scoreAndClassifyUrl(urlStr: string, linkText: string): { score: number; page_type: ScanPage['page_type']; evidence: string } {
  const combined = `${urlStr.toLowerCase()} ${linkText.toLowerCase()}`;
  if (/(pricing|plans|pricing-plans|subscription-cost|tiers|licensing)/i.test(combined)) {
    return { score: 35, page_type: 'pricing', evidence: 'matched pricing keyword' };
  }
  if (/(checkout|pay|payment|order-review|billing)/i.test(combined)) {
    return { score: 30, page_type: 'checkout', evidence: 'matched checkout keyword' };
  }
  if (/(cart|basket|bag)/i.test(combined)) {
    return { score: 25, page_type: 'cart', evidence: 'matched shopping cart keyword' };
  }
  if (/(cancel|unsubscribe|delete-account|close-account)/i.test(combined)) {
    return { score: 30, page_type: 'cancel', evidence: 'matched cancel/retention keyword' };
  }
  if (/(signup|register|join|create-account)/i.test(combined)) {
    return { score: 20, page_type: 'signup', evidence: 'matched sign up keyword' };
  }
  if (/(cookie|privacy|terms|gdpr|preferences)/i.test(combined)) {
    return { score: 20, page_type: 'consent', evidence: 'matched privacy/consent keyword' };
  }
  if (/(blog|news|press|article|story|careers|jobs)/i.test(combined)) {
    return { score: -20, page_type: 'other', evidence: 'low-priority content section' };
  }
  return { score: 5, page_type: 'other', evidence: 'general navigation link' };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { scan_id, action } = req.query || {};

  // 1. GET /api/scans/:id -> retrieve scan
  if (req.method === 'GET') {
    if (!scan_id) {
      return res.status(400).json({ detail: 'Scan ID required.' });
    }
    const existing = scansCache.get(scan_id as string);
    if (!existing) {
      return res.status(404).json({ detail: `Scan '${scan_id}' not found.` });
    }
    return res.status(200).json(existing);
  }

  // 2. POST /api/scans/:id/cancel -> cancel scan
  if (req.method === 'POST' && scan_id && action === 'cancel') {
    const existing = scansCache.get(scan_id as string);
    if (existing) {
      existing.status = 'cancelled';
      return res.status(200).json(existing);
    }
    return res.status(404).json({ detail: `Scan '${scan_id}' not found.` });
  }

  // 3. POST /api/scans -> create and run scan
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method not allowed.' });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }
    payload = payload || {};

    let rootUrl = payload.root_url || '';
    if (!rootUrl) {
      return res.status(400).json({ detail: 'Must provide root_url.' });
    }

    if (!/^https?:\/\//i.test(rootUrl)) {
      rootUrl = `https://${rootUrl}`;
    }

    let parsedRoot: URL;
    try {
      parsedRoot = new URL(rootUrl);
    } catch {
      return res.status(400).json({ detail: 'Invalid root URL format.' });
    }

    if (isPrivateIpOrHost(parsedRoot.hostname)) {
      return res.status(400).json({ detail: 'SSRF Security Violation: Access to private networks is forbidden.' });
    }

    const scanId = `scan_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();

    // Fetch root landing page HTML
    let rootHtml = '';
    let rootStatus: ScanPage['page_status'] = 'ok';
    let rootStatusReason = 'Queued for analysis';

    try {
      const rootResp = await fetch(rootUrl, {
        headers: {
          'User-Agent': 'ClearClickAI-Auditor/1.0 (+https://clearclickai.com/bot; research transparency scanner)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!rootResp.ok) {
        if (rootResp.status === 403 || rootResp.status === 429) {
          rootStatus = 'blocked';
          rootStatusReason = `Target site returned HTTP ${rootResp.status} anti-bot wall`;
        } else {
          rootStatus = 'error';
          rootStatusReason = `HTTP error ${rootResp.status} (${rootResp.statusText})`;
        }
      } else {
        rootHtml = await rootResp.text();
        if (/(verify\s+you\s+are\s+human|attention\s+required!|access\s+denied|cf-chl)/i.test(rootHtml)) {
          rootStatus = 'blocked';
          rootStatusReason = 'Bot challenge wall detected';
        } else if (rootHtml.trim().length < 100) {
          rootStatus = 'empty';
          rootStatusReason = 'Insufficient visible text';
        }
      }
    } catch (fetchErr: any) {
      rootStatus = 'error';
      rootStatusReason = `Network error: ${fetchErr?.message || 'Connection failed'}`;
    }

    // Extract links from root HTML
    const candidateUrls: Array<{ url: string; linkText: string }> = [];
    const seenUrls = new Set<string>();
    seenUrls.add(rootUrl.replace(/\/+$/, ''));

    if (rootHtml) {
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
      let lMatch: RegExpExecArray | null;
      while ((lMatch = linkRegex.exec(rootHtml)) !== null) {
        const rawHref = lMatch[1].trim();
        const lText = lMatch[2].replace(/<[^>]+>/g, ' ').trim();
        if (rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) {
          continue;
        }
        try {
          const resolved = new URL(rawHref, rootUrl);
          if (resolved.hostname === parsedRoot.hostname) {
            resolved.hash = '';
            // Remove tracking params
            const toDel = [];
            for (const key of resolved.searchParams.keys()) {
              if (key.startsWith('utm_') || key === 'fbclid' || key === 'gclid') toDel.push(key);
            }
            toDel.forEach((k) => resolved.searchParams.delete(k));
            const cleanUrl = resolved.toString().replace(/\/+$/, '');
            if (!seenUrls.has(cleanUrl)) {
              seenUrls.add(cleanUrl);
              candidateUrls.push({ url: cleanUrl, linkText: lText });
            }
          }
        } catch {
          // Ignore invalid link
        }
      }
    }

    // Score and rank candidates
    const scoredCandidates = candidateUrls.map((c) => {
      const { score, page_type, evidence } = scoreAndClassifyUrl(c.url, c.linkText);
      return {
        url: c.url,
        linkText: c.linkText,
        score,
        page_type,
        evidence,
      };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);

    // Build ScanPage list
    const maxAnalysed = Math.min(payload.max_pages || 4, 4); // Limit to 4 on serverless to ensure sub-5s response
    const pages: ScanPage[] = [];

    // 1. Root page
    const rootFindings = rootStatus === 'ok' ? detectDarkPatterns(rootHtml) : [];
    const rootTitleMatch = rootHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
    pages.push({
      url: rootUrl,
      page_type: 'consent',
      page_status: rootStatus,
      status_reason: rootStatusReason,
      decision: 'will_analyse',
      score: 100,
      evidence: 'Root landing page',
      depth: 0,
      page_title: rootTitleMatch ? rootTitleMatch[1].trim() : parsedRoot.hostname,
      screenshot_base64: `https://s0.wp.com/mshots/v1/${encodeURIComponent(rootUrl)}?w=1280&h=900`,
      findings: rootFindings,
      ai_status: payload.include_ai ? 'ai_skipped_budget' : 'not_run',
      ai_status_message: 'Rule engine evaluated',
    });

    // 2. Candidate pages
    const willAnalyse = scoredCandidates.slice(0, maxAnalysed - 1);
    const skipped = scoredCandidates.slice(maxAnalysed - 1);

    // Fetch and analyze top candidate pages in parallel
    await Promise.all(
      willAnalyse.map(async (c) => {
        let pStatus: ScanPage['page_status'] = 'ok';
        let pReason = 'Queued for analysis';
        let pHtml = '';

        try {
          const resp = await fetch(c.url, {
            headers: {
              'User-Agent': 'ClearClickAI-Auditor/1.0 (+https://clearclickai.com/bot; research transparency scanner)',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(5000),
          });

          if (!resp.ok) {
            if (resp.status === 403 || resp.status === 429) {
              pStatus = 'blocked';
              pReason = `Target site returned HTTP ${resp.status} anti-bot wall`;
            } else {
              pStatus = 'error';
              pReason = `HTTP error ${resp.status}`;
            }
          } else {
            pHtml = await resp.text();
            if (/(verify\s+you\s+are\s+human|attention\s+required!|access\s+denied|cf-chl)/i.test(pHtml)) {
              pStatus = 'blocked';
              pReason = 'Bot challenge wall detected';
            } else if (pHtml.trim().length < 100) {
              pStatus = 'empty';
              pReason = 'Insufficient content';
            }
          }
        } catch (err: any) {
          pStatus = 'error';
          pReason = `Fetch failed: ${err?.message || 'timeout'}`;
        }

        const pFindings = pStatus === 'ok' ? detectDarkPatterns(pHtml) : [];
        const tMatch = pHtml.match(/<title[^>]*>([^<]+)<\/title>/i);

        pages.push({
          url: c.url,
          page_type: c.page_type,
          page_status: pStatus,
          status_reason: pReason,
          decision: 'will_analyse',
          score: c.score,
          evidence: c.evidence,
          depth: 1,
          page_title: tMatch ? tMatch[1].trim() : c.url,
          screenshot_base64: `https://s0.wp.com/mshots/v1/${encodeURIComponent(c.url)}?w=1280&h=900`,
          findings: pFindings,
          ai_status: payload.include_ai ? 'ai_skipped_budget' : 'not_run',
          ai_status_message: 'Rule engine evaluated',
        });
      })
    );

    // Append skipped pages
    for (const s of skipped.slice(0, 10)) {
      const decision = s.score <= 0 ? 'skipped_low_priority' : 'skipped_cap';
      pages.push({
        url: s.url,
        page_type: s.page_type,
        page_status: 'empty',
        status_reason: decision === 'skipped_cap' ? `Skipped: maximum analysed pages cap reached (${maxAnalysed})` : `Skipped low priority page (${s.score} pts)`,
        decision,
        skipped_reason: decision,
        score: s.score,
        evidence: s.evidence,
        depth: 1,
        page_title: s.url,
        screenshot_base64: null,
        findings: [],
        ai_status: 'not_run',
        ai_status_message: 'Skipped before analysis',
      });
    }

    // Group findings across pages
    const groupMap = new Map<string, GroupedFinding>();
    for (const p of pages) {
      for (const f of p.findings) {
        const fp = `${f.category}::${f.type}::${f.evidence.slice(0, 40).toLowerCase().trim()}`;
        if (!groupMap.has(fp)) {
          groupMap.set(fp, {
            ...f,
            element_fingerprint: `fp_${Math.abs(hashString(fp)) % 100000}`,
            pages: [p.url],
            page_types: [p.page_type],
            sample_bbox: f.bbox,
          });
        } else {
          const existing = groupMap.get(fp)!;
          if (!existing.pages.includes(p.url)) existing.pages.push(p.url);
          if (!existing.page_types.includes(p.page_type)) existing.page_types.push(p.page_type);
        }
      }
    }

    const grouped_findings = Array.from(groupMap.values());

    // Compute coverage
    const keyCategories = ['pricing', 'cart', 'checkout', 'signup', 'cancel', 'consent'];
    const keyFound = Array.from(new Set(pages.filter((p) => keyCategories.includes(p.page_type)).map((p) => p.page_type)));
    const keyReached = Array.from(
      new Set(pages.filter((p) => keyCategories.includes(p.page_type) && p.page_status === 'ok').map((p) => p.page_type))
    );

    const skippedReasons: Record<string, number> = {};
    for (const p of pages) {
      if (p.skipped_reason) {
        skippedReasons[p.skipped_reason] = (skippedReasons[p.skipped_reason] || 0) + 1;
      }
    }

    const coverage: Coverage = {
      pages_discovered: pages.length,
      pages_analysed: pages.filter((p) => p.decision === 'will_analyse' && p.page_status === 'ok').length,
      pages_skipped_by_reason: skippedReasons,
      pages_blocked: pages.filter((p) => p.page_status === 'blocked').length,
      pages_needs_login: pages.filter((p) => p.page_status === 'needs_login').length,
      pages_ai_analysed: 0,
      ai_calls_used: 0,
      key_page_types_found: keyFound,
      key_page_types_reached: keyReached,
    };

    const finishedScan: Scan = {
      scan_id: scanId,
      root_url: rootUrl,
      status: 'completed',
      created_at: nowIso,
      completed_at: new Date().toISOString(),
      config_snapshot: {
        max_pages_analysed: maxAnalysed,
        user_agent: 'ClearClickAI-Auditor/1.0',
        deployment: 'vercel-serverless',
      },
      pages,
      grouped_findings,
      coverage,
      error_message: null,
    };

    scansCache.set(scanId, finishedScan);

    return res.status(201).json(finishedScan);
  } catch (error: any) {
    console.error('Scan error:', error);
    return res.status(500).json({
      detail: `Site scan failed: ${error.message || 'Internal server error'}`,
    });
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
