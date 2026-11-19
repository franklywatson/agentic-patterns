import type { DiffFile } from './types';

/** Parse a unified diff (as produced by `diff -u` or `git diff`) into per-file changes. */
export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let oldPath = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('--- ')) {
      oldPath = line.slice(4).split('\t')[0];
      current = null;
    } else if (line.startsWith('+++ ') && !current) {
      const newPath = line.slice(4).split('\t')[0];
      const path = (newPath === '/dev/null' ? oldPath : newPath).replace(/^[ab]\//, '');
      const status = oldPath === '/dev/null' ? 'added' : newPath === '/dev/null' ? 'deleted' : 'modified';
      current = { path, status, added: [], removed: [] };
      files.push(current);
    } else if (current && line.startsWith('+')) {
      current.added.push(line.slice(1));
    } else if (current && line.startsWith('-')) {
      current.removed.push(line.slice(1));
    }
  }
  return files;
}

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
