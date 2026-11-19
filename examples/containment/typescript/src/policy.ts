import { readFileSync } from "node:fs";
import path from "node:path";

export type Decision = "allow" | "deny" | "ask";

export interface ToolCall {
  tool: "Read" | "Write" | "Bash" | "WebFetch";
  path?: string;
  command?: string;
  url?: string;
}

interface PatternRule {
  id: string;
  regex: string;
}

export interface Rules {
  credentials: {
    basenames: string[];
    basenamePrefixes: string[];
    basenameAllow: string[];
    pathPrefixes: string[];
  };
  shellWritePatterns: PatternRule[];
  askPatterns: PatternRule[];
  egress: {
    allowedHosts: string[];
    networkCommandRegex: string;
    urlHostRegex: string;
  };
}

export interface Context {
  projectRoot: string;
  home: string;
}

export interface Result {
  decision: Decision;
  rule: string;
}

const RULES_FILE = new URL("../../rules.json", import.meta.url);

export function loadRules(): Rules {
  return JSON.parse(readFileSync(RULES_FILE, "utf8")) as Rules;
}

function resolvePath(p: string, ctx: Context): string {
  const expanded = p === "~" || p.startsWith("~/") ? path.join(ctx.home, p.slice(1)) : p;
  return path.resolve(ctx.projectRoot, expanded);
}

function isUnder(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function isCredential(p: string, rules: Rules, ctx: Context): boolean {
  const resolved = resolvePath(p, ctx);
  const base = path.basename(resolved);
  if (rules.credentials.basenameAllow.includes(base)) return false;
  if (rules.credentials.basenames.includes(base)) return true;
  if (rules.credentials.basenamePrefixes.some((prefix) => base.startsWith(prefix))) return true;
  return rules.credentials.pathPrefixes.some((prefix) => isUnder(resolved, resolvePath(prefix, ctx)));
}

function firstMatch(command: string, patterns: PatternRule[]): string | null {
  const hit = patterns.find((rule) => new RegExp(rule.regex).test(command));
  return hit ? hit.id : null;
}

function disallowedHosts(text: string, rules: Rules): string[] {
  const urlHost = new RegExp(rules.egress.urlHostRegex, "g");
  const hosts = [...text.matchAll(urlHost)].map((m) => m[1].toLowerCase());
  return hosts.filter((host) => !rules.egress.allowedHosts.includes(host));
}

export function decide(call: ToolCall, rules: Rules, ctx: Context): Result {
  switch (call.tool) {
    case "Read":
      if (isCredential(call.path ?? "", rules, ctx)) return { decision: "deny", rule: "credential-read" };
      return { decision: "allow", rule: "default" };
    case "Write": {
      const target = call.path ?? "";
      if (isCredential(target, rules, ctx)) return { decision: "deny", rule: "credential-write" };
      if (!isUnder(resolvePath(target, ctx), ctx.projectRoot)) return { decision: "deny", rule: "write-outside-project" };
      return { decision: "allow", rule: "default" };
    }
    case "Bash": {
      const command = call.command ?? "";
      const writeRule = firstMatch(command, rules.shellWritePatterns);
      if (writeRule) return { decision: "deny", rule: `shell-write:${writeRule}` };
      if (new RegExp(rules.egress.networkCommandRegex).test(command) && disallowedHosts(command, rules).length > 0) {
        return { decision: "deny", rule: "egress-host" };
      }
      const askRule = firstMatch(command, rules.askPatterns);
      if (askRule) return { decision: "ask", rule: `ask:${askRule}` };
      return { decision: "allow", rule: "default" };
    }
    case "WebFetch":
      if (disallowedHosts(call.url ?? "", rules).length > 0) return { decision: "deny", rule: "egress-host" };
      return { decision: "allow", rule: "default" };
    default:
      return { decision: "ask", rule: "unknown-tool" };
  }
}
