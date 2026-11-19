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
});
