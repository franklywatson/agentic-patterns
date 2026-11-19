import { posix } from 'node:path';
import type { DiffFile } from './types';

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** Lines git writes between `diff --git` and the file headers. */
const GIT_EXTENDED = /^(old mode|new mode|deleted file mode|new file mode|similarity index|dissimilarity index|index|copy from|copy to|rename from|rename to) /;
/** A line of a `GIT binary patch` block: `literal N`, `delta N`, or base85 data (a length letter, no spaces). */
const GIT_BINARY_LINE = /^(?:(?:literal|delta) \d+|[A-Za-z][0-9A-Za-z!#$%&()*+;<=>?@^_`{|}~-]*)$/;
const C_ESCAPES: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92 };

/**
 * Read a C-quoted name (`"a\tb"`, `"caf\303\251"`) as git and GNU diff write it, from the start of `text`.
 * Returns the name and the rest of the text, or null when the quoting is malformed.
 */
function unquote(text: string): { name: string; rest: string } | null {
  if (!text.startsWith('"')) return null;
  const bytes: number[] = [];
  for (let i = 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') return { name: new TextDecoder('utf-8').decode(new Uint8Array(bytes)), rest: text.slice(i + 1) };
    if (ch !== '\\') {
      bytes.push(...new TextEncoder().encode(ch));
      continue;
    }
    const next = text[i + 1] ?? '';
    if (/^[0-3][0-7][0-7]$/.test(text.slice(i + 1, i + 4))) {
      bytes.push(parseInt(text.slice(i + 1, i + 4), 8));
      i += 3;
    } else if (next in C_ESCAPES) {
      bytes.push(C_ESCAPES[next]);
      i += 1;
    } else {
      return null;
    }
  }
  return null;
}

/** The name in a `---`/`+++` header: quoted, or the text before the one tab that starts the timestamp. */
function headerName(text: string): string | null {
  if (text.startsWith('"')) {
    const q = unquote(text);
    return q !== null && (q.rest === '' || q.rest.startsWith('\t')) ? q.name : null;
  }
  const parts = text.split('\t');
  return parts.length > 2 ? null : parts[0];
}

/** Drop the first path component (a/, b/ or a directory name from `diff -r`). */
const stripFirst = (p: string): string => p.replace(/^[^/]+\//, '');

/** A name that is quoted must be quoted whole; an unquoted name is taken as is. */
function wholeName(text: string): string | null {
  if (!text.startsWith('"')) return text;
  const q = unquote(text);
  return q !== null && q.rest === '' ? q.name : null;
}

/**
 * Split "<old> <sep> <new>" where either name may contain the separator. A split counts when one side is
 * /dev/null or both sides name the same path after the first component; exactly one split must count.
 */
function splitPair(text: string, sep: string): { old: string; new: string } | null {
  const found: { old: string; new: string }[] = [];
  if (text.startsWith('"')) {
    const q = unquote(text);
    if (q === null || !q.rest.startsWith(sep)) return null;
    const second = wholeName(q.rest.slice(sep.length));
    return second === null ? null : { old: q.name, new: second };
  }
  for (let i = text.indexOf(sep); i !== -1; i = text.indexOf(sep, i + 1)) {
    const left = text.slice(0, i);
    const right = wholeName(text.slice(i + sep.length));
    if (right === null) continue;
    if (left === '/dev/null' || right === '/dev/null' || stripFirst(left) === stripFirst(right)) found.push({ old: left, new: right });
  }
  return found.length === 1 ? found[0] : null;
}

/**
 * Parse a unified diff into per-file changes: `diff -ruN` output or a git diff. Paths come from the
 * `---`/`+++` headers, `rename from`/`rename to`, `diff --git` and `Binary files ... differ` lines, with
 * git's C quoting. A name that contains the separator (" and ", a space, a tab) is accepted only when exactly
 * one reading names the same path on both sides. The parser follows hunk line counts, as `patch` does, so a
 * removed line that starts with "-- " is not mistaken for a header. The first path component (a/, b/ or a
 * directory name from `diff -r`) is stripped. A line that cannot be read this way, or a name that cannot be
 * read unambiguously, becomes an entry marked `unparsed` whose path is the raw line: it classifies as unknown.
 */
export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = text.split('\n');
  let current: DiffFile | null = null;
  let oldHeader: string | null | undefined;
  let oldLeft = 0;
  let newLeft = 0;
  let firstHunk = false;
  let inBinary = false;
  let git: { names: { old: string; new: string } | null; from?: string; to?: string; line: string; emitted: boolean } | null = null;
  const push = (file: DiffFile): DiffFile => {
    files.push(file);
    return file;
  };
  const unparsed = (line: string): DiffFile => push({ path: line, status: 'modified', added: [], removed: [], unparsed: true });
  const finishGit = () => {
    if (git === null || git.emitted) return;
    git.emitted = true;
    const from = git.from ?? git.names?.old;
    const to = git.to ?? git.names?.new;
    if (from === undefined || to === undefined) {
      unparsed(git.line);
      return;
    }
    push({ path: stripFirst(to), status: 'modified', added: [], removed: [] });
    if (stripFirst(from) !== stripFirst(to)) push({ path: stripFirst(from), status: 'deleted', added: [], removed: [] });
  };
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
      } else if (tag !== '\\') {
        unparsed(line);
      }
      continue;
    }
    if (inBinary) {
      if (line === '' || GIT_BINARY_LINE.test(line)) continue;
      inBinary = false;
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
    } else if (line.startsWith('diff --git ')) {
      finishGit();
      current = null;
      oldHeader = undefined;
      git = { names: splitPair(line.slice(11), ' '), line, emitted: false };
    } else if (git !== null && !git.emitted && GIT_EXTENDED.test(line)) {
      const m = /^(rename|copy) (from|to) ([\s\S]*)$/.exec(line);
      if (m) {
        const name = wholeName(m[3]);
        if (name === null) {
          git.emitted = true;
          unparsed(line);
        } else if (m[2] === 'from') {
          if (m[1] === 'rename') git.from = `a/${name}`;
        } else {
          git.to = `b/${name}`;
        }
      }
    } else if (line.startsWith('--- ')) {
      oldHeader = headerName(line.slice(4));
      current = null;
    } else if (line.startsWith('+++ ') && current === null && oldHeader !== undefined) {
      const newHeader = headerName(line.slice(4));
      if (git !== null) git.emitted = true;
      if (oldHeader === null || newHeader === null) {
        current = unparsed(line);
      } else {
        const status = oldHeader === '/dev/null' ? 'added' : newHeader === '/dev/null' ? 'deleted' : 'modified';
        current = push({ path: stripFirst(newHeader === '/dev/null' ? oldHeader : newHeader), status, added: [], removed: [] });
        if (status === 'modified' && stripFirst(oldHeader) !== stripFirst(newHeader)) {
          push({ path: stripFirst(oldHeader), status: 'deleted', added: [], removed: [] });
        }
      }
      firstHunk = true;
      oldHeader = undefined;
    } else if (line.startsWith('Binary files ') || line === 'GIT binary patch') {
      // A git diff names the file in its `diff --git` and rename lines; a `diff -r` binary line names it itself.
      inBinary = line === 'GIT binary patch';
      if (git !== null && !git.emitted) {
        const first = files.length;
        finishGit();
        files[first].added.push('<binary content>');
      } else {
        const m = /^Binary files ([\s\S]+) differ$/.exec(line);
        const pair = m ? splitPair(m[1], ' and ') : null;
        if (pair === null) unparsed(line);
        else push({ path: stripFirst(pair.new === '/dev/null' ? pair.old : pair.new), status: 'modified', added: ['<binary content>'], removed: [] });
      }
      current = null;
    } else if (line === '' || line.startsWith('\\') || (/^diff /.test(line) && git === null)) {
      // blank lines, "\ No newline at end of file", and the `diff -ruN a b` line before each file in `diff -r` output
    } else {
      unparsed(line);
    }
  }
  finishGit();
  return files;
}

/** Control characters other than tab and carriage return: a text patch has none, a binary file has NUL. */
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

/**
 * Strict check that a patch is a plain unified diff and nothing else. Outside hunk bodies the
 * only accepted lines are blank lines, `--- `/`+++ ` file headers and `@@` hunk headers, so
 * context-diff headers (`***`), `Index:`, `diff --git`, `rename`, `copy`, mode lines (including
 * symlink mode 120000) and binary patches are all refused. A control character (NUL included) in a
 * header or a hunk line is refused, so the patch cannot create a binary file. Hunk bodies are read by
 * line count, so content such as `+++ ../x` inside a hunk is not mistaken for a header. Returns the
 * file paths.
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
      if (CONTROL.test(name) || name.startsWith('"')) throw new Error(`patch names an unsafe path: ${JSON.stringify(name)}`);
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
        if (CONTROL.test(body)) throw new Error('patch is not a plain unified diff: control character in a hunk line');
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

/**
 * Match a path against a glob. `**` crosses directories, `*` does not, and neither matches a line
 * terminator (the same rule in Python). `ignoreCase` folds ASCII letters only.
 */
export function globMatch(glob: string, path: string, ignoreCase = false): boolean {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      source += '[^\\n\\r\\u2028\\u2029]*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (c === '*') {
      source += '[^/\\n\\r\\u2028\\u2029]*';
    } else {
      source += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`, ignoreCase ? 'i' : '').test(path);
}
