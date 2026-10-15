export type CategoryType = 'hidden_charges' | 'cancellation' | 'consent';
export type SeverityType = 'low' | 'medium' | 'high';
export type SourceType = 'rule' | 'ai' | 'hybrid';

export interface Finding {
  category: CategoryType;
  type: string;
  severity: SeverityType;
  confidence: number;
  evidence: string;
  bbox: [number, number, number, number];
  why: string;
  safer_alternative: string;
  source: SourceType;
}

export interface AnalysisReport {
  url: string;
  timestamp: string;
  disclaimer: string;
  summary_by_category: Record<CategoryType, number>;
  findings: Finding[];
  rule_findings?: Finding[];
  ai_findings?: Finding[];
  rule_findings_count?: number;
  ai_findings_count?: number;
  ai_status?: 'not_run' | 'completed' | 'failed';
  ai_status_message?: string;
  screenshot_base64?: string;
  page_title: string;
  is_flow?: boolean;
  step_count?: number;
}

export interface CorpusItem {
  id: string;
  file: string;
  category: CategoryType;
  patterns: string[];
  notes: string;
}

export interface BenchmarkMetrics {
  precision: number;
  recall: number;
  f1: number;
  tp: number;
  fp: number;
  fn: number;
}

export interface BenchmarkResult {
  split: string;
  include_ai?: boolean;
  ai_status?: string;
  ai_status_message?: string;
  overall: BenchmarkMetrics & { total: number };
  categories: Record<CategoryType, BenchmarkMetrics>;
  details: Array<{
    id: string;
    status: 'PASS' | 'FAIL';
    category?: string;
    expected: string[];
    detected: string[];
    tp: number;
    fp: number;
    fn: number;
  }>;
}
