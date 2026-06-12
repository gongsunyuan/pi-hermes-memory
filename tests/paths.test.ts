import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import * as assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { detectMemoryRoot } from "../src/paths.js";

const TEST_DIR = path.join(os.tmpdir(), `hermes-paths-test-${Date.now()}`);

describe("detectMemoryRoot", () => {
  before(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  after(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("项目级安装: 返回 <proj>/.pi/hermes-memory/", () => {
    const projectDir = path.join(TEST_DIR, "my-project");
    const piDir = path.join(projectDir, ".pi");
    const extensionsDir = path.join(piDir, "extensions");
    const npmDir = path.join(extensionsDir, "npm", "pi-hermes-memory", "src");
    fs.mkdirSync(npmDir, { recursive: true });

    const entryFile = path.join(npmDir, "index.ts");
    const result = detectMemoryRoot(entryFile);
    assert.equal(result, path.join(piDir, "hermes-memory"));
  });

  it("全局安装: 返回 ~/.pi/agent/pi-hermes-memory/", () => {
    const homePiDir = path.join(TEST_DIR, ".pi-global");
    const agentDir = path.join(homePiDir, ".pi", "agent");
    const extensionsDir = path.join(agentDir, "extensions", "npm", "pi-hermes-memory", "src");
    fs.mkdirSync(extensionsDir, { recursive: true });

    const entryFile = path.join(extensionsDir, "index.ts");
    const result = detectMemoryRoot(entryFile);
    assert.equal(result, path.join(agentDir, "pi-hermes-memory"));
  });

  it("找不到 .pi/ 目录时回退到默认路径", () => {
    const entryFile = path.join(TEST_DIR, "no-pi-dir", "some-ext", "index.ts");
    fs.mkdirSync(path.dirname(entryFile), { recursive: true });

    const result = detectMemoryRoot(entryFile);
    const expected = path.join(os.homedir(), ".pi", "agent", "pi-hermes-memory");
    assert.equal(result, expected);
  });
});
