import * as os from "node:os";
import * as path from "node:path";
import { existsSync } from "node:fs";
import { DEFAULT_PROJECTS_MEMORY_DIR } from "./constants.js";

export const AGENT_ROOT = path.join(os.homedir(), ".pi", "agent");

export function expandHome(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

export function normalizeConfiguredMemoryDir(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const expanded = expandHome(trimmed);
  if (path.isAbsolute(expanded)) return path.normalize(expanded);
  return path.resolve(AGENT_ROOT, expanded);
}

function isSafeRelativeDirectory(input: string): boolean {
  const segments = input.split(/[\\/]+/).filter(Boolean);
  return segments.length === 1 && segments[0] !== "." && segments[0] !== "..";
}

export function normalizeProjectsMemoryDir(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const expanded = expandHome(trimmed);
  let relative = expanded;

  if (path.isAbsolute(expanded)) {
    const resolved = path.resolve(expanded);
    const relativeToAgentRoot = path.relative(AGENT_ROOT, resolved);
    if (
      relativeToAgentRoot === ""
      || relativeToAgentRoot.startsWith("..")
      || path.isAbsolute(relativeToAgentRoot)
    ) {
      return undefined;
    }
    relative = relativeToAgentRoot;
  }

  const normalized = path.normalize(relative).replace(/^[\\/]+|[\\/]+$/g, "");
  if (!isSafeRelativeDirectory(normalized)) return undefined;
  return normalized;
}

export function resolveProjectsRoot(projectsMemoryDir = DEFAULT_PROJECTS_MEMORY_DIR): string {
  const normalized = normalizeProjectsMemoryDir(projectsMemoryDir) ?? DEFAULT_PROJECTS_MEMORY_DIR;
  return path.join(AGENT_ROOT, normalized);
}

/**
 * 从 extension 入口文件路径检测记忆根目录。
 *
 * 全局安装: ~/.pi/agent/extensions/.../index.ts
 *   → 向上找到 ~/.pi（含 agent/子目录）→ ~/.pi/agent/pi-hermes-memory/
 * 项目级安装: <proj>/.pi/extensions/.../index.ts
 *   → 向上找到 <proj>/.pi（不含 agent/）→ <proj>/.pi/hermes-memory/
 */
export function detectMemoryRoot(entryFile: string): string {
  let dir = path.dirname(entryFile);
  while (dir !== path.dirname(dir)) {
    const piDir = path.join(dir, ".pi");
    if (existsSync(piDir)) {
      if (existsSync(path.join(piDir, "agent"))) {
        return path.join(piDir, "agent", "pi-hermes-memory");
      }
      return path.join(piDir, "hermes-memory");
    }
    dir = path.dirname(dir);
  }
  return path.join(os.homedir(), ".pi", "agent", "pi-hermes-memory");
}
