import { loadIncidentRecord } from '../../src/config';
import { fingerprintOf, fingerprintsFromLog, parseIncident } from '../../src/incident';
import { renderReproduction, reproPath } from '../../src/reproduce';

const record = () => JSON.parse(JSON.stringify(loadIncidentRecord('INC-001')));

describe('incident', () => {
  test('INC-001 parses and its fingerprint matches the record', () => {
    const incident = parseIncident(record());
    expect(incident.fingerprint).toBe(fingerprintOf('GET /users/:id', 500, 'pg:22P02'));
  });

  test('a fingerprint that does not match the record is rejected', () => {
    const bad = { ...record(), fingerprint: '000000000000' };
    expect(() => parseIncident(bad)).toThrow('does not match the record');
  });

  test('an email address in the request is rejected', () => {
    const bad = record();
    bad.request.path = '/users/by-email/alice@example.com';
    expect(() => parseIncident(bad)).toThrow('email address');
  });

  test('a secret field in the request is rejected', () => {
    const bad = record();
    bad.request.body = { password: 'x' };
    expect(() => parseIncident(bad)).toThrow('secret field');
  });

  test('a missing field is rejected by name', () => {
    const bad = record();
    delete bad.expected;
    expect(() => parseIncident(bad)).toThrow('missing "expected"');
  });

  test('fingerprintsFromLog finds structured error lines and ignores other text', () => {
    const log = [
      'app-1  | app listening on 3000',
      'app-1  | {"level":"error","event":"unhandled_error","route":"GET /users/:id","status":500,"errorClass":"pg:22P02"}',
      'app-1  | {"level":"info","event":"other"}',
    ].join('\n');
    expect(fingerprintsFromLog(log)).toEqual([fingerprintOf('GET /users/:id', 500, 'pg:22P02')]);
  });

  test('the rendered reproduction asserts the expected status and body, unconditionally', () => {
    const incident = parseIncident(record());
    const source = renderReproduction(incident);
    expect(reproPath(incident)).toBe('tests/repro/INC-001.repro.test.ts');
    expect(source).toContain('expect(response.status).toBe(404);');
    expect(source).toContain('expect(response.data).toEqual({"error":"User not found"});');
    expect(source).not.toMatch(/\bif\s*\(/);
  });

  test.each([
    ['id', (r: any) => { r.id = '../../../escaped'; }],
    ['journey', (r: any) => { r.journey = "x');process.exit(1);('"; }],
    ['method', (r: any) => { r.request.method = "GET', url: 'x"; }],
    ['path with a quote', (r: any) => { r.request.path = "/x');require('fs');test('y"; }],
    ['path with ..', (r: any) => { r.request.path = '/a/../b'; }],
    ['replay path', (r: any) => { r.replayPaths = ['/ok', '/bad path']; }],
    ['header value with a newline', (r: any) => { r.request.headers.accept = 'x\nimport os'; }],
    ['errorClass', (r: any) => { r.errorClass = 'a b'; }],
  ])('untrusted %s is rejected before any code is generated', (_name, mutate) => {
    const bad = record();
    mutate(bad);
    expect(() => parseIncident(bad)).toThrow(/invalid|does not match|email/);
  });

  test('secret-like keys are rejected anywhere in request, observed and expected', () => {
    for (const where of ['request', 'observed', 'expected'] as const) {
      const bad = record();
      bad[where].extra = { 'x-api-key': 'k' };
      expect(() => parseIncident(bad)).toThrow('secret field');
    }
    const cookie = record();
    cookie.request.headers['set-cookie'] = 'a=b';
    expect(() => parseIncident(cookie)).toThrow('secret field');
  });

  test('the rendered reproduction carries every record value as a JSON literal', () => {
    const incident = parseIncident(record());
    const source = renderReproduction({ ...incident, journey: 'user-lookup' });
    expect(source).toContain('url: "/users/undefined"');
    expect(source).toContain('describe("INC-001 reproduction: user-lookup"');
  });

  const PAYLOADS = ["a'b", 'a`b', 'a"b', '../x', 'a\nb', '${x}', 'a\\b', '$(id)', "');process.exit(1);('", 'a b', 'INC-1\n', '/ok\n'];
  const FIELDS: [string, (r: any, v: string) => void][] = [
    ['id', (r, v) => { r.id = v; }],
    ['journey', (r, v) => { r.journey = v; }],
    ['entrypoint', (r, v) => { r.entrypoint = v; }],
    ['errorClass', (r, v) => { r.errorClass = v; }],
    ['method', (r, v) => { r.request.method = v; }],
    ['path', (r, v) => { r.request.path = `/${v}`; }],
    ['replay path', (r, v) => { r.replayPaths = [`/${v}`]; }],
    ['header name', (r, v) => { r.request.headers = { [v]: 'x' }; }],
  ];

  test('fuzz: no payload in any untrusted field is accepted', () => {
    const accepted: string[] = [];
    for (const [name, set] of FIELDS) {
      for (const payload of PAYLOADS) {
        const bad = record();
        set(bad, payload);
        try {
          parseIncident(bad);
          accepted.push(`${name}=${JSON.stringify(payload)}`);
        } catch {
          // rejected, as required
        }
      }
    }
    expect(accepted).toEqual([]);
  });

  test('a header value with quotes is allowed because it enters the source as an escaped literal', () => {
    const r = record();
    r.request.headers = { accept: `a'b"c\`d` };
    const source = renderReproduction(parseIncident(r));
    expect(source).toContain(`headers: ${JSON.stringify({ accept: `a'b"c\`d` })}`);
  });
});
