import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Blast, RepairPolicy, Reversibility } from './types';

export const SHARED_DIR = join(__dirname, '..', '..', 'shared');

export interface ReversibilityRules {
  unknown: { reversibility: Reversibility; blast: Blast };
  paths: { glob: string; reversibility: Reversibility; blast: Blast }[];
  content: { name: string; pattern: string; reversibility?: Reversibility; blast?: Blast }[];
}

const readJson = <T>(...parts: string[]): T =>
  JSON.parse(readFileSync(join(SHARED_DIR, ...parts), 'utf-8')) as T;

export const loadRules = (): ReversibilityRules => readJson('config', 'reversibility.json');
export const loadPolicy = (): RepairPolicy => readJson('config', 'repair-policy.json');
export const loadIncidentRecord = (id: string): unknown => readJson('incidents', `${id}.json`);
