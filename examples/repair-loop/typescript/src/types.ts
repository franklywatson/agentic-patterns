export type Reversibility = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
export type Blast = 'B0' | 'B1' | 'B2' | 'B3';
export type Grant = 'A1' | 'A2' | 'A3' | 'A4' | 'A5';
export type Decision = 'auto' | 'human' | 'block';

export interface Incident {
  id: string;
  fingerprint: string;
  journey: string;
  entrypoint: string;
  errorClass: string;
  request: { method: string; path: string; headers: Record<string, string>; body: unknown };
  observed: { status: number; body: unknown };
  expected: { status: number; body: Record<string, unknown> };
  dependencies: Record<string, { connected: boolean }>;
  detectedAt: string;
}

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  added: string[];
  removed: string[];
}

export interface Classification {
  reversibility: Reversibility;
  blast: Blast;
  reasons: string[];
}

export interface AntimaskHit {
  rule: 'swallowed-exception' | 'new-retry' | 'widened-timeout' | 'lowered-threshold';
  file: string;
  line: string;
}

export interface EvidenceBundle {
  incidentId: string;
  fingerprint: string;
  reproduction: {
    redOnBase: boolean;
    greenOnCandidate: boolean;
    frozenSha256: string;
    currentSha256: string;
  };
  regression: 'pass' | 'fail';
  diff: DiffFile[];
  classification: Classification;
  antimask: AntimaskHit[];
  budget: { attemptsUsed: number; attemptsAllowed: number; cooldownActive: boolean };
  grant: Grant;
  stopEngaged: boolean;
}

export interface GatePolicy {
  minGrantForAuto: Grant;
  autoCeiling: { reversibility: Reversibility; blast: Blast };
  protectedPaths: string[];
  existingTestsGlob: string;
}

export interface GateResult {
  decision: Decision;
  reasons: string[];
}

export interface RepairPolicy extends GatePolicy {
  workflow: string;
  grant: Grant;
  owner: string;
  budget: { attemptsPerFingerprint: number; cooldownSeconds: number };
  breaker: { recurrenceWindowDays: number; tripRecurrences: number; resetCleanRepairs: number };
  confirm: { minSamples: number; maxFingerprintCount: number };
}
