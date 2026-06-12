# Project-Local Memory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持 `pi install -l npm:pi-hermes-memory` 项目级安装，记忆留在 `<proj>/.pi/hermes-memory/` 中，不碰 `~/.pi`。全局安装用户零感知。

**Architecture:** 新增 `detectMemoryRoot()` 函数从入口文件路径推导记忆根目录，替换 `index.ts` 中硬编码的 `AGENT_ROOT`。项目 `.pi` 和全局 `~/.pi` 通过 `agent/` 子目录是否存在来区分。

**Tech Stack:** TypeScript (jiti), Node.js `node:fs`/`node:path`/`node:url`, `node:test` + `node:assert/strict`

**Spec:** `docs/superpowers/specs/2026-06-12-project-local-memory-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/paths.ts` | Modify | 新增 `detectMemoryRoot()` |
| `src/index.ts` | Modify | 入口用 `detectMemoryRoot` 替换路径逻辑 |
| `tests/paths.test.ts` | Create | `detectMemoryRoot` 单元测试 |
| `README.md` | Modify | 添加项目级安装说明 |

---

### Task 1: `detectMemoryRoot()` — 实现 + 测试

**Files:**
- Create: `tests/paths.test.ts`
- Modify: `src/paths.ts`

- [ ] **Step 1: 写测试文件**

创建 `tests/paths.test.ts`：

```typescript
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
    // 模拟项目结构
    const projectDir = path.join(TEST_DIR, "my-project");
    const piDir = path.join(projectDir, ".pi");
    const extensionsDir = path.join(piDir, "extensions");
    const npmDir = path.join(extensionsDir, "npm", "pi-hermes-memory", "src");
    fs.mkdirSync(npmDir, { recursive: true });

    const entryFile = path.join(npmDir, "index.ts");
    // 项目 .pi 目录没有 agent/ 子目录 → 项目级
    const result = detectMemoryRoot(entryFile);
    assert.equal(result, path.join(piDir, "hermes-memory"));
  });

  it("全局安装: 返回 ~/.pi/agent/pi-hermes-memory/", () => {
    // 模拟全局 Pi 结构（~/.pi/agent/）
    const homePiDir = path.join(TEST_DIR, ".pi-global");
    const agentDir = path.join(homePiDir, ".pi", "agent");
    const extensionsDir = path.join(agentDir, "extensions", "npm", "pi-hermes-memory", "src");
    fs.mkdirSync(extensionsDir, { recursive: true });

    const entryFile = path.join(extensionsDir, "index.ts");
    // ~/.pi 有 agent/ 子目录 → 全局
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
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd /mnt/c/Users/10850/Documents/codelab/pi-hermes-memory && node --import jiti/register --test tests/paths.test.ts
```

Expected: FAIL — `detectMemoryRoot` not exported from paths.ts

- [ ] **Step 3: 在 `src/paths.ts` 中实现 `detectMemoryRoot`**

在 `src/paths.ts` 末尾添加：

```typescript
import { existsSync } from "node:fs";

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
```

- [ ] **Step 4: 运行测试验证通过**

```bash
node --import jiti/register --test tests/paths.test.ts
```

Expected: 3/3 PASS

- [ ] **Step 5: Commit**

```bash
git add src/paths.ts tests/paths.test.ts
git commit -m "feat(paths): add detectMemoryRoot() for project-local memory detection"
```

---

### Task 2: `index.ts` — 用 `detectMemoryRoot` 替换路径逻辑

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: 替换入口路径逻辑**

修改 `src/index.ts`，将：

```typescript
import { AGENT_ROOT } from "./paths.js";
```

改为：

```typescript
import { detectMemoryRoot } from "./paths.js";
import { fileURLToPath } from "node:url";
```

然后将：

```typescript
  const agentRoot = AGENT_ROOT;
  const legacyGlobalDir = path.join(agentRoot, "memory");
  const defaultGlobalDir = path.join(agentRoot, "pi-hermes-memory");

  const configuredMemoryDir = config.memoryDir?.trim();
  const pointsToLegacyMemoryDir = configuredMemoryDir
    ? path.resolve(configuredMemoryDir) === path.resolve(legacyGlobalDir)
    : false;

  const globalDir = !configuredMemoryDir || pointsToLegacyMemoryDir
    ? defaultGlobalDir
    : configuredMemoryDir;

  const shouldMigrateExtensionRoot = !configuredMemoryDir || pointsToLegacyMemoryDir;
```

改为：

```typescript
  const baseDir = detectMemoryRoot(fileURLToPath(import.meta.url));
  const agentRoot = path.dirname(baseDir);
  const legacyGlobalDir = path.join(agentRoot, "memory");
  const shouldMigrateExtensionRoot = true;
```

- [ ] **Step 2: 全局替换 `globalDir` → `baseDir`**

在 `src/index.ts` 中将所有 `globalDir` 替换为 `baseDir`（共 ~15 处）：

涉及行：
- `const store = new MemoryStore({ ...config, memoryDir: globalDir });` → `baseDir`
- `globalSkillsDir: path.join(globalDir, "skills"),` → `baseDir`
- `migrationSentinelPath: path.join(globalDir, ".skills-migrated-to-extension-storage"),` → `baseDir`
- `const dbManager = new DatabaseManager(globalDir);` → `baseDir`
- `syncMarkdownMemoriesToSqlite(dbManager, globalDir, ...)` → `baseDir`
- `registerSyncMarkdownMemoriesCommand(pi, dbManager, globalDir, ...)` → `baseDir`
- `migrateExtensionRoot(legacyGlobalDir, globalDir)` → `baseDir`

- [ ] **Step 3: 类型检查**

```bash
npm run check
```

Expected: zero errors

- [ ] **Step 4: 运行全部测试**

```bash
npm test
```

Expected: 全部通过（如果 npm test 不可用，则用 node test runner）

```bash
node --import jiti/register --test tests/paths.test.ts tests/store/memory-store.test.ts tests/handlers/system-prompt.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat(index): use detectMemoryRoot() for project-local memory dir"
```

---

### Task 3: README — 添加项目级安装说明

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 Quick Start**

在 `README.md` 的 "Quick Start" 部分，将：

```markdown
## Quick Start

```bash
# Install
pi install npm:pi-hermes-memory
```

改为：

```markdown
## Quick Start

```bash
# 全局安装（所有项目共享记忆）
pi install npm:pi-hermes-memory

# 项目级安装（记忆留在项目 .pi/hermes-memory/ 中，不污染 ~/.pi）
pi install -l npm:pi-hermes-memory
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): add project-local install instructions"
```

---

### Task 4: 最终验证 + Release

- [ ] **Step 1: 完整测试**

```bash
npm run check && npm test
```

Expected: type check zero errors, all tests pass

- [ ] **Step 2: 手动验证项目级安装**

```bash
# 在测试项目中
cd /tmp/test-project
mkdir -p .pi
pi install -l /path/to/pi-hermes-memory
pi -p "save a test memory"

# 验证记忆文件在正确位置
ls .pi/hermes-memory/
# 应有: MEMORY.md, USER.md
```

- [ ] **Step 3: 版本号 + 提交**

```bash
# 不需要单独 bump 版本号，随下次 release 一起
git add -A
git commit -m "chore: final verification for project-local memory"
```
