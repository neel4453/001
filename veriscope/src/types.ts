/** Domain model shared by background, side panel, popup and options. */

export type Mode = 'offline' | 'online';

export type ClaimKind =
  | 'factual'
  | 'opinion'
  | 'prediction'
  | 'question'
  | 'recommendation'
  | 'hypothetical'
  | 'satire-candidate'
  | 'unknown';

export type Verdict =
  | 'supported'
  | 'mostly-supported'
  | 'partially-supported'
  | 'misleading'
  | 'contradicted'
  | 'outdated'
  | 'unverified'
  | 'disputed'
  | 'opinion'
  | 'prediction'
  | 'ambiguous'
  | 'satire-hypothetical';

export type EvidenceRelation = 'unassessed' | 'supports' | 'contradicts' | 'contextualizes';

export type SourceType =
  | 'primary'
  | 'official-statistics'
  | 'academic'
  | 'fact-checker'
  | 'news'
  | 'reference'
  | 'social'
  | 'user-supplied';

export type AccessStatus =
  | 'not-checked'
  | 'website-verified'
  | 'search-page-verified'
  | 'public-document-access-verified'
  | 'api-integration-verified'
  | 'restricted'
  | 'unavailable'
  | 'historical-archive';

export type RetrievalMode =
  | 'open-search-page'
  | 'navigate-document'
  | 'fetch-public-page'
  | 'parse-dataset'
  | 'local-index'
  | 'user-supplied'
  | 'public-api-optional';

export type CategoryId =
  | 'fact-checking'
  | 'un-mun'
  | 'government'
  | 'politics'
  | 'country-statistics'
  | 'academic'
  | 'news'
  | 'social-media'
  | 'images-video'
  | 'health'
  | 'environment'
  | 'law'
  | 'finance'
  | 'cybersecurity'
  | 'reference';

export interface SourceEntry {
  id: string;
  name: string;
  url: string;
  /** Template with {query} placeholder, or null when manual navigation is required. */
  searchUrl: string | null;
  /** True when the searchUrl pattern is commonly used but not verified against the live site here. */
  searchUrlVerified: boolean;
  categories: CategoryId[];
  countries: string[]; // ISO codes or 'world'
  sourceType: SourceType;
  retrievalMode: RetrievalMode;
  accessStatus: AccessStatus;
  apiKeyRequired: boolean;
  paidServiceRequired: boolean;
  automationAllowed: boolean;
  /** For retrievalMode 'public-api-optional': fetch adapter id (see src/core/adapters). */
  adapter?: string;
  notes?: string;
  lastChecked: string | null;
}

export interface NumericFact {
  raw: string;
  value: number | null; // normalized base value (see core/units.ts)
  unit: string;
  kind: 'count' | 'percent' | 'currency' | 'other';
  currency?: string;
}

export interface DateFact {
  raw: string;
  year: number | null;
  month?: number;
  day?: number;
  precision: 'year' | 'month' | 'day' | 'relative';
}

export interface ClaimSpan {
  start: number;
  end: number;
}

export interface Claim {
  id: string;
  text: string;
  /** Containing original passage, preserved verbatim. */
  originalPassage?: string;
  kind: ClaimKind;
  isQuotation: boolean;
  numbers: NumericFact[];
  dates: DateFact[];
  entities: string[];
  topics: CategoryId[];
  spans: ClaimSpan[];
  /** Names of context pieces that are required but missing (e.g. 'time period', 'currency'). */
  contextMissing: string[];
}

export interface RelationSuggestion {
  relation: Exclude<EvidenceRelation, 'unassessed'>;
  reason: string;
  /** 0 none .. 2 strong. Suggestions are ALWAYS provisional — never shown as final. */
  strength: 0 | 1 | 2;
  provisional: true;
}

export interface EvidenceRecord {
  id: string;
  claimId: string;
  sourceId?: string;
  publisher: string;
  domain: string;
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: string;
  accessedAt: string;
  origin: 'automatic' | 'user-added' | 'saved-page' | 'search-link-opened';
  relation: EvidenceRelation;
  relationSetBy: 'user' | 'heuristic' | null;
  relationSuggestion?: RelationSuggestion;
  independenceKey: string;
  duplicateOf?: string;
  notes?: string;
}

export interface ConfidenceFactor {
  name: string;
  value: number; // 0..1
  explanation: string;
}

export interface VerdictResult {
  verdict: Verdict;
  label: string;
  explanation: string;
  confidence: {
    band: 'low' | 'medium' | 'high';
    score: number; // 0..1 explainable weighting — NOT a calibrated probability
    factors: ConfidenceFactor[];
    note: string;
  };
  retrievedCount: number; // sources actually accessed automatically
  manualOnly: boolean; // true when no automated retrieval happened
  caveats: string[];
}

export interface ChangeLogEntry {
  at: string;
  what: string;
}

export type ClaimSourceKind =
  | 'selection'
  | 'manual'
  | 'page'
  | 'ai-answer'
  | 'document'
  | 'speech'
  | 'image';

export interface Investigation {
  id: string;
  createdAt: string;
  updatedAt: string;
  mode: Mode;
  status: 'draft' | 'evidence-gathered' | 'verdict-proposed' | 'user-flagged';
  source: {
    kind: ClaimSourceKind;
    url?: string;
    title?: string;
    documentName?: string;
    passageRef?: ClaimSpan;
    speaker?: string;
    committee?: string;
    country?: string;
    period?: string;
    documentRef?: string;
  };
  claim: Claim;
  /** Original claim text, immutable after creation (corrections go to annotations, never overwrite). */
  originalClaimText: string;
  annotations: string[];
  evidence: EvidenceRecord[];
  verdict: VerdictResult;
  userFlag?: { reason: string; at: string };
  changeLog: ChangeLogEntry[];
}

export interface HistoryEntry {
  id: string;
  at: string;
  claimText: string;
  verdict: Verdict;
  verdictLabel: string;
  evidenceCount: number;
  mode: Mode;
}

export interface DocumentFinding {
  id: string;
  kind:
    | 'internal-inconsistency'
    | 'conflicting-date'
    | 'inconsistent-number'
    | 'unit-mismatch'
    | 'terminology-shift'
    | 'unsupported-assertion'
    | 'citation-error'
    | 'missing-reference'
    | 'duplicate-passage'
    | 'quotation-mismatch'
    | 'outdated-statistic'
    | 'ambiguous-wording'
    | 'extraction-error';
  severity: 'info' | 'review' | 'strong';
  message: string;
  span: ClaimSpan;
  section?: string;
  evidenceUrls?: string[];
  humanReviewRequired: true;
}

export interface ParsedDocument {
  name: string;
  format: 'pdf' | 'txt' | 'md' | 'html' | 'docx' | 'csv' | 'json';
  text: string;
  pages?: { page: number; start: number; end: number }[];
  warnings: string[];
  meta?: Record<string, string>;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  mode: Mode;
  /** Automated key-free public API lookups (online mode only). */
  autoQueries: boolean;
  sourcesDisabled: string[];
  historyLimit: number;
  /** Optional contact address for API polite pools (e.g. OpenAlex); empty = omit. */
  politePoolEmail: string;
  ollamaEnabled: boolean;
  ollamaUrl: string;
  ollamaModel: string;
  /** Chrome Web Speech uses Google's cloud service. Off = local/imported transcripts only. */
  allowCloudSpeech: boolean;
  localEngineUrl: string;
  localEngineEnabled: boolean;
  firstRunDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  mode: 'online',
  autoQueries: true,
  sourcesDisabled: [],
  historyLimit: 200,
  politePoolEmail: '',
  ollamaEnabled: false,
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1:8b',
  allowCloudSpeech: false,
  localEngineUrl: 'http://127.0.0.1:8756',
  localEngineEnabled: false,
  firstRunDone: false,
};

export interface PendingAction {
  kind: 'selection' | 'page' | 'image' | 'manual';
  text?: string;
  url?: string;
  pageTitle?: string;
  imageUrl?: string;
  at: string;
}

export interface RegistryLoadResult {
  sources: SourceEntry[];
  errors: string[];
}
