import sampleReports from '../frontend/src/data/sampleReports.json';

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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method not allowed. Use POST.' });
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

    const { url, html_content, corpus_id } = payload;

    // 1. If corpus fixture was chosen, return ground-truth precomputed report
    if (corpus_id && (sampleReports as Record<string, any>)[corpus_id]) {
      return res.status(200).json((sampleReports as Record<string, any>)[corpus_id]);
    }

    if (!url && !html_content) {
      return res.status(400).json({ detail: 'Must provide url, html_content, or valid corpus_id.' });
    }

    let html = html_content || '';
    let targetUrl = url || '';

    // 2. Fetch live URL if provided
    if (!html && targetUrl) {
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = `https://${targetUrl}`;
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
      } catch {
        return res.status(400).json({ detail: 'Invalid URL format.' });
      }

      if (isPrivateIpOrHost(parsedUrl.hostname)) {
        return res.status(400).json({ detail: 'SSRF Security Violation: Access to private networks is forbidden.' });
      }

      try {
        const fetchResponse = await fetch(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
          },
          signal: AbortSignal.timeout(12000),
        });

        if (!fetchResponse.ok) {
          const status = fetchResponse.status;
          if (status === 403) {
            return res.status(502).json({
              detail: `External site returned HTTP 403 (Forbidden). The target website is protected by an anti-bot firewall (such as DataDome or Cloudflare) which blocks automated inspection requests. Tip: Try accessible sites like CNN, BBC, The Guardian, Wikipedia, or Steam — or upload the page's HTML file directly via the "HTML" tab!`,
            });
          }
          return res.status(502).json({
            detail: `External site returned HTTP ${status} (${fetchResponse.statusText})`,
          });
        }

        html = await fetchResponse.text();
      } catch (err: any) {
        return res.status(502).json({
          detail: `Failed to fetch target URL: ${err.message || 'Connection timed out or network error'}`,
        });
      }
    }

    // 3. Extract metadata
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : targetUrl;

    const findings: Finding[] = [];
    const cleanText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    // DETECTOR 1: Manipulative Consent
    const pretickedRegex = /<input[^>]+type=["']?checkbox["']?[^>]*checked[^>]*>/gi;
    let match: RegExpExecArray | null;
    while ((match = pretickedRegex.exec(html)) !== null) {
      const snippet = match[0];
      const startIdx = Math.max(0, match.index - 150);
      const endIdx = Math.min(html.length, match.index + snippet.length + 150);
      const contextText = html.slice(startIdx, endIdx).replace(/<[^>]+>/g, ' ');

      if (
        /(marketing|promotional|newsletter|partner|offers|third[- ]party|advertising|share.*profile)/i.test(contextText)
      ) {
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

    const doubleNegRegex = /(do\s+not\s+wish\s+to\s+not\s+receive|uncheck\s+if\s+you\s+do\s+not\s+want|opt-out\s+of\s+not\s+receiving)/i;
    const doubleNegMatch = cleanText.match(doubleNegRegex);
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

    if (/(cookie|privacy\s+preference|tracking)/i.test(cleanText)) {
      const hasAccept = /(accept\s+all|agree\s+to\s+all|allow\s+all)/i.test(html);
      const hasReject = /(reject\s+all|refuse\s+all|decline\s+all)/i.test(html);
      const hasPreferences = /(manage\s+preferences|cookie\s+settings|more\s+options)/i.test(html);

      if (hasAccept && !hasReject && hasPreferences) {
        findings.push({
          category: 'consent',
          type: 'missing_reject_option',
          severity: 'medium',
          confidence: 0.9,
          evidence: 'Cookie banner provides "Accept All" and "Manage Preferences" without a direct first-layer Reject button.',
          bbox: [60, 320, 200, 36],
          why: 'The first layer of this consent banner lacks an equivalent, direct "Reject All" button, requiring extra friction to decline.',
          safer_alternative: 'Provide an equal-prominence "Reject All" button on the first layer.',
          source: 'rule',
        });
      } else if (hasAccept && hasReject) {
        const acceptSnippet = html.match(/<button[^>]*>[^<]*accept[^<]*<\/button>/i)?.[0] || '';
        const rejectSnippet = html.match(/<(button|a)[^>]*>[^<]*reject[^<]*<\/(button|a)>/i)?.[0] || '';
        if (
          (acceptSnippet.includes('primary') || acceptSnippet.includes('bold')) &&
          (rejectSnippet.includes('secondary') || rejectSnippet.includes('link') || rejectSnippet.includes('muted'))
        ) {
          findings.push({
            category: 'consent',
            type: 'unequal_button_emphasis',
            severity: 'medium',
            confidence: 0.88,
            evidence: `Accept button: "${acceptSnippet.replace(/<[^>]+>/g, '').trim()}" vs Reject: "${rejectSnippet.replace(/<[^>]+>/g, '').trim()}"`,
            bbox: [60, 320, 220, 36],
            why: 'Accept and Reject options possess asymmetric visual hierarchy, visually steering users toward consenting.',
            safer_alternative: 'Style Accept and Reject buttons with equal visual contrast, weight, and size.',
            source: 'rule',
          });
        }
      }
    }

    // DETECTOR 2: Hidden Charges
    const feeRegex = /([$€£₹]\s*[0-9]+(?:\.[0-9]{2})?)\s*(?:resort|facilities|service|cleaning|booking|delivery|mandatory|processing)?\s*(?:fee|charge|surcharge)/i;
    const feeMatch = cleanText.match(feeRegex);

    const microprintRegex = /font-size\s*:\s*([6-9]|10|11)px[^>]*>[^<]*(?:fee|surcharge|charge|mandatory|resort)[^<]*/i;
    const microMatch = html.match(microprintRegex);
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
    } else if (feeMatch && /(drip|late|final\s+step|added\s+at\s+checkout)/i.test(cleanText)) {
      findings.push({
        category: 'hidden_charges',
        type: 'drip_pricing',
        severity: 'high',
        confidence: 0.86,
        evidence: feeMatch[0],
        bbox: [40, 420, 250, 24],
        why: 'Mandatory fees appear late in the transaction flow rather than being included in the headline price.',
        safer_alternative: 'Display the total all-inclusive price upfront on initial selection.',
        source: 'rule',
      });
    }

    // DETECTOR 3: Misleading Cancellation
    const confirmShamingRegex = /(hate\s+saving\s+money|don'?t\s+want\s+discounts|prefer\s+paying\s+full|no\s+thanks.*hate|no\s+thanks.*give\s+up|no\s+thanks.*pay\s+more)/i;
    const shamingMatch = cleanText.match(confirmShamingRegex);
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

    const buriedRegex = /(cancel\s+subscription|delete\s+account|end\s+membership)[^<]{0,40}(?:font-size\s*:\s*(?:8|9|10)px|color\s*:\s*#(?:888|999|aaa|bbb|ccc))/i;
    const buriedMatch = html.match(buriedRegex);
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

    const summary_by_category = {
      consent: findings.filter((f) => f.category === 'consent').length,
      hidden_charges: findings.filter((f) => f.category === 'hidden_charges').length,
      cancellation: findings.filter((f) => f.category === 'cancellation').length,
    };

    const report = {
      url: targetUrl || 'Uploaded HTML Document',
      timestamp: new Date().toISOString(),
      disclaimer: 'ClearClick AI findings are automated warnings for human review, not legal conclusions.',
      summary_by_category,
      findings,
      rule_findings: findings,
      ai_findings: [],
      rule_findings_count: findings.length,
      ai_findings_count: 0,
      ai_status: 'completed',
      ai_status_message: 'Serverless inspection completed successfully',
      screenshot_base64: null,
      page_title: pageTitle,
      is_flow: false,
      step_count: 1,
    };

    return res.status(200).json(report);
  } catch (error: any) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      detail: `Analysis failed: ${error.message || 'Internal server error'}`,
    });
  }
}
