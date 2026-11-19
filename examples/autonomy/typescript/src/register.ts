import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import { parse } from "yaml";
import { SCHEMA_PATH, readJson } from "./util.js";
import type { Json } from "./util.js";

export interface SchemaError {
  path: string;
  keyword: string;
}

let validator: ReturnType<Ajv["compile"]> | null = null;

function compiled() {
  if (validator === null) {
    const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
    validator = ajv.compile(readJson(SCHEMA_PATH));
  }
  return validator;
}

export function loadRegisterFile(path: string): Json {
  return parse(readFileSync(path, "utf8"));
}

/** Validate a parsed register. Returns normalised, sorted, de-duplicated errors. */
export function validateRegister(data: Json): SchemaError[] {
  const validate = compiled();
  validate(data);
  const found = new Map<string, SchemaError>();
  for (const err of validate.errors ?? []) {
    if (err.keyword === "if") continue;
    let path = err.instancePath;
    if (err.keyword === "required") path += `/${err.params.missingProperty}`;
    if (err.keyword === "additionalProperties") path += `/${err.params.additionalProperty}`;
    found.set(`${path}|${err.keyword}`, { path, keyword: err.keyword });
  }
  const key = (e: SchemaError) => `${e.path}|${e.keyword}`;
  return [...found.values()].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}
