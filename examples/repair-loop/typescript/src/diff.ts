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

/** A path the gate refuses: absolute, empty, with a `..` segment, a backslash or a NUL. */
export function isUnsafePath(path: string): boolean {
  return path === '' || path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').includes('..');
}

/** Normalize a safe path; an unsafe path is returned unchanged so that callers keep it visible. */
export const normalizePath = (path: string): string => (isUnsafePath(path) ? path : posix.normalize(path));

/** Match a path against a glob. `**` crosses directories, `*` does not. */
export function globMatch(glob: string, path: string): boolean {
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
  return new RegExp(`^${source}$`).test(path);
}
