export type CategoryType = 'hidden_charges' | 'cancellation' | 'consent';
export type SeverityType = 'low' | 'medium' | 'high';
export type SourceType = 'rule' | 'ai' | 'hybrid';
export type SignalStrengthType = 'high' | 'medium' | 'review';

export interface RelatedSignal {
  type: string;
  severity: SeverityType;
  confidence: number;
  evidence: string;
  element_id?: string;
  source: SourceType;
  signal_strength?: SignalStrengthType;
}

export interface Finding {
  category: CategoryType;
  type: string;
  severity: SeverityType;
  confidence: number;
  signal_strength?: SignalStrengthType;
  evidence: string;
  bbox: [number, number, number, number];
  why: string;
  safer_alternative: string;
  source: SourceType;
  element_id?: string;
  related_signals?: RelatedSignal[];
  rule_confidence?: number;
  ai_confidence?: number;
  rule_evidence?: string;
  ai_evidence?: string;
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
  ai_status?: 'ran' | 'skipped_no_key' | 'ai_skipped_budget' | 'unavailable' | 'limit_reached' | 'invalid_response' | 'completed' | 'not_run' | 'failed';
  ai_status_message?: string;
  screenshot_base64?: string;
  page_title: string;
  page_status?: 'ok' | 'blocked' | 'needs_login' | 'empty' | 'timeout' | 'robots_disallowed' | 'invalid_url' | 'error';
  status_reason?: string;
  is_flow?: boolean;
  step_count?: number;
}

export type PageStatus = 'ok' | 'blocked' | 'needs_login' | 'empty' | 'timeout' | 'robots_disallowed' | 'invalid_url' | 'error';
export type PageType = 'pricing' | 'cart' | 'checkout' | 'signup' | 'account' | 'cancel' | 'consent' | 'other';
export type SkippedReason = 'skipped_low_priority' | 'skipped_duplicate' | 'skipped_robots' | 'skipped_cap' | 'skipped_blocked_domain';
export type ScanDecision = 'will_analyse' | 'skipped_low_priority' | 'skipped_duplicate' | 'skipped_robots' | 'skipped_cap';
export type ScanAIStatus = 'ran' | 'not_run' | 'skipped_no_key' | 'ai_skipped_budget' | 'limit_reached' | 'unavailable' | 'invalid_response';

export interface ScanPage {
  url: string;
  page_type: PageType;
  page_type_evidence?: string;
  score?: number;
  decision?: ScanDecision;
  page_status: PageStatus;
  status_reason?: string;
  ai_status?: ScanAIStatus;
  ai_status_message?: string;
  findings: Finding[];
  skipped_reason?: SkippedReason;
  screenshot_base64?: string;
  page_title?: string;
  discovered_from?: string;
  depth?: number;
}

export interface GroupedFinding {
  category: CategoryType;
  type: string;
  severity: SeverityType;
  confidence: number;
  evidence: string;
  why: string;
  safer_alternative: string;
  source: SourceType;
  element_fingerprint: string;
  pages: string[];
  page_types: string[];
  sample_bbox?: [number, number, number, number];
}

export interface Coverage {
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

export interface Scan {
  scan_id: string;
  root_url: string;
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
  created_at: string;
  completed_at?: string;
  config_snapshot: Record<string, any>;
  pages: ScanPage[];
  grouped_findings: GroupedFinding[];
  coverage: Coverage;
  error_message?: string;
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

export interface FlowStepResult {
  step_index: number;
  step_name: string;
  url?: string;
  status: 'reached' | 'not_reached';
  stopped_reason?: string;
}

export interface GuidedFlowResult {
  flow_id: string;
  root_url: string;
  status: 'completed' | 'aborted' | 'failed';
  flow_stopped_reason?: string;
  steps: FlowStepResult[];
  findings: Finding[];
}

