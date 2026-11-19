import { readFileSync } from "node:fs";

export interface Case {
  id: string;
  command: string;
  policy: "allow" | "deny" | "ask";
}

interface CaseFile {
  writeCases: Case[];
  networkCases: Case[];
}

const file = JSON.parse(readFileSync(new URL("../../cases.json", import.meta.url), "utf8")) as CaseFile;

export const writeCases: Case[] = file.writeCases;
export const networkCases: Case[] = file.networkCases;
