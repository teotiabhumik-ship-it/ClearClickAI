import sampleReports from '../frontend/src/data/sampleReports.json';

/**
 * Static-host fallback for deployments without the FastAPI/Playwright backend.
 *
 * Live analysis intentionally does not run here. Keeping a second regex-based
 * analyzer in a serverless function made security and detector behavior differ
 * from the canonical Python backend. Users can still open bundled sample
 * reports, or configure a live FastAPI server in the frontend settings.
 */
export default function staticAnalyzeHandler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method not allowed. Use POST.' });
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = {};
    }
  }

  const corpusId = payload?.corpus_id;
  const report = corpusId ? (sampleReports as Record<string, unknown>)[corpusId] : undefined;
  if (report) {
    return res.status(200).json(report);
  }

  return res.status(501).json({
    detail:
      'Live analysis is not available on the static deployment. Configure a running FastAPI backend in Server Settings, or choose a bundled Ground-Truth Sample Case.',
  });
}
