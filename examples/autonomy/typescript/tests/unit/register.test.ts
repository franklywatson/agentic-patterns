import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";
import { loadRegisterFile, validateRegister } from "../../src/register.js";
import { fixture, readFixtureJson } from "../helpers.js";

test("the valid example register has no schema errors", () => {
  const errors = validateRegister(loadRegisterFile(fixture("registers", "valid", ".autonomy.yaml")));
  assert.deepEqual(errors, []);
});

const expected = readFixtureJson("registers", "invalid", "expected.json") as Record<string, unknown[]>;

for (const [name, want] of Object.entries(expected)) {
  test(`invalid register ${name} fails with exactly the expected errors`, () => {
    const errors = validateRegister(loadRegisterFile(fixture("registers", "invalid", `${name}.yaml`)));
    assert.deepEqual(errors, want);
  });
}

test("every invalid fixture has an expectation", () => {
  const files = readdirSync(fixture("registers", "invalid")).filter((f) => f.endsWith(".yaml")).map((f) => f.replace(".yaml", "")).sort();
  assert.deepEqual(files, Object.keys(expected).sort());
});

test("a level 3 workflow with a full trifecta passes once a gate is named", () => {
  const register = loadRegisterFile(fixture("registers", "invalid", "trifecta-no-gate.yaml"));
  register.workflows[0].risk.gate = "required-approval-check";
  assert.deepEqual(validateRegister(register), []);
});

test("a level 2 workflow with a full trifecta needs no gate", () => {
  const register = loadRegisterFile(fixture("registers", "invalid", "trifecta-no-gate.yaml"));
  register.workflows[0].granted_level = 2;
  assert.deepEqual(validateRegister(register), []);
});

test("YAML 1.1 words stay strings: on, yes and no are not booleans", () => {
  const register = parseYaml("trigger: on\nname: yes\nother: no\n");
  assert.deepEqual(register, { trigger: "on", name: "yes", other: "no" });
});

test("a trailing newline does not satisfy the date pattern", () => {
  const register = loadRegisterFile(fixture("registers", "valid", ".autonomy.yaml"));
  register.workflows[0].review_date = "2027-02-01\n";
  assert.deepEqual(validateRegister(register).map((e) => `${e.path}:${e.keyword}`), ["/workflows/0/review_date:pattern"]);
});
