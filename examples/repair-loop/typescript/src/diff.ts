import { posix } from 'node:path';
import type { DiffFile } from './types';

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parse a unified diff into per-file changes. The parser follows hunk line counts, as
 * `patch` does, so a removed line that starts with "-- " is not mistaken for a file header.
 * The first path component (a/, b/ or a directory name from `diff -r`) is stripped.
 */
export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = text.split('\n');
  let oldPath = '';
  let current: DiffFile | null = null;
  let oldLeft = 0;
  let newLeft = 0;
  let firstHunk = false;
  const strip = (p: string) => p.split('\t')[0].replace(/^[^/]+\//, '');
  for (const line of lines) {
    if (oldLeft > 0 || newLeft > 0) {
      const tag = line[0];
      if (tag === '+') {
        current!.added.push(line.slice(1));
        newLeft--;
      } else if (tag === '-') {
        current!.removed.push(line.slice(1));
        oldLeft--;
      } else if (tag === ' ' || line === '') {
        oldLeft--;
        newLeft--;
      }
      continue;
    }
    const hunk = HUNK.exec(line);
    if (hunk && current) {
      oldLeft = Number(hunk[2] ?? 1);
      newLeft = Number(hunk[4] ?? 1);
      if (firstHunk) {
        if (hunk[1] === '0' && oldLeft === 0) current.status = 'added';
        if (hunk[3] === '0' && newLeft === 0) current.status = 'deleted';
        firstHunk = false;
      }
    } else if (line.startsWith('--- ')) {
      oldPath = line.slice(4).split('\t')[0];
      current = null;
    } else if (line.startsWith('+++ ') && !current && oldPath !== '') {
      const newPath = line.slice(4).split('\t')[0];
      const path = strip(newPath === '/dev/null' ? oldPath : newPath);
      const status = oldPath === '/dev/null' ? 'added' : newPath === '/dev/null' ? 'deleted' : 'modified';
      current = { path, status, added: [], removed: [] };
      files.push(current);
      firstHunk = true;
      oldPath = '';
    } else if (line.startsWith('Binary files ')) {
      const m = /^Binary files (.+) and (.+) differ$/.exec(line);
      if (m) files.push({ path: strip(m[2]), status: 'modified', added: ['<binary content>'], removed: [] });
    }
  }
  return files;
}

/**
 * Strict check that a patch is a plain unified diff and nothing else. Outside hunk bodies the
 * only accepted lines are blank lines, `--- `/`+++ ` file headers and `@@` hunk headers, so
 * context-diff headers (`***`), `Index:`, `diff --git`, `rename`, `copy`, mode lines (including
 * symlink mode 120000) and binary patches are all refused. Hunk bodies are read by line count, so
 * content such as `+++ ../x` inside a hunk is not mistaken for a header. Returns the file paths.
 */
export function assertPlainUnifiedPatch(text: string): string[] {
  const lines = text.split('\n');
  const paths: string[] = [];
  const headerPath = (line: string): string => line.slice(4).split('\t')[0];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line === '') {
      i++;
      continue;
    }
    if (!line.startsWith('--- ')) throw new Error(`patch is not a plain unified diff: unexpected line "${line.slice(0, 60)}"`);
    const oldName = headerPath(line);
    const next = lines[i + 1];
    if (next === undefined || !next.startsWith('+++ ')) throw new Error('patch is not a plain unified diff: "---" is not followed by "+++"');
    const newName = headerPath(next);
    for (const name of [oldName, newName]) {
      if (name === '/dev/null') continue;
      const stripped = name.replace(/^[^/]+\//, '');
      if (name.startsWith('/') || isUnsafePath(stripped)) throw new Error(`patch names an unsafe path: ${name}`);
    }
    paths.push(newName === '/dev/null' ? oldName : newName);
    i += 2;
    if (!HUNK.test(lines[i] ?? '')) throw new Error('patch is not a plain unified diff: file header without a hunk');
    while (HUNK.test(lines[i] ?? '')) {
      const hunk = HUNK.exec(lines[i])!;
      let oldLeft = Number(hunk[2] ?? 1);
      let newLeft = Number(hunk[4] ?? 1);
      i++;
      while (oldLeft > 0 || newLeft > 0) {
        const body = lines[i];
        if (body === undefined) throw new Error('patch is not a plain unified diff: truncated hunk');
        if (body[0] === '+') newLeft--;
        else if (body[0] === '-') oldLeft--;
        else if (body[0] === ' ' || body === '') {
          oldLeft--;
          newLeft--;
        } else throw new Error(`patch is not a plain unified diff: bad hunk line "${body.slice(0, 60)}"`);
        i++;
      }
      while (lines[i]?.startsWith('\\')) i++;
    }
  }
  if (paths.length === 0) throw new Error('patch contains no files');
  return paths;
}

/** A path the gate refuses: absolute, empty, with a `..` segment, a backslash or a NUL. */
export function isUnsafePath(path: string): boolean {
  return path === '' || path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').includes('..');
}

/** Normalize a safe path; an unsafe path is returned unchanged so that callers keep it visible. */
export const normalizePath = (path: string): string => (isUnsafePath(path) ? path : posix.normalize(path));

/** Match a path against a glob. `**` crosses directories, `*` does not. `ignoreCase` folds ASCII letters only. */
export function globMatch(glob: string, path: string, ignoreCase = false): boolean {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      source += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (c === '*') {
      source += '[^/]*';
    } else {
      source += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`, ignoreCase ? 'i' : '').test(path);
}
