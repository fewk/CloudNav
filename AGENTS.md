# CloudNav AI Agent 协作与版本管理指示规范 (AGENTS.md)

本文档是面向所有 AI 编码助手（包括 Google Antigravity、Claude Code、Cursor、GitHub Copilot、Codex 等）的项目工程开发与协作准则。任何 AI Agent 在本仓库工作时，**必须严格遵循**以下指引。

---

## 📌 1. 项目架构与核心技术栈

- **前端技术栈**：React 19 + TypeScript + Vite 6 + Tailwind CSS 3 + Lucide Icons
- **后端与部署**：Cloudflare Pages Functions + Cloudflare KV 云数据库
- **代码规范**：所有文件使用 TypeScript 强类型，严禁跳过类型检查。

---

## 🏷️ 2. 版本号管理规范 (SemVer 语义化版本)

### 2.1 单一数据源 (Single Source of Truth)
- 本项目的版本号 **唯一真理来源为 `package.json` 中的 `version` 字段**。
- `version.ts` 会自动读取 Vite 编译期注入的 `__APP_VERSION__` 与 `__BUILD_TIME__`。
- **严禁**在任何 `.tsx` / `.jsx` / `.ts` 组件中硬编码静态版本号（如写死 `"v1.8.2"` 或 `"v2.0.0"`）。展示版本时必须从 `./version` 导入 `APP_VERSION`。

### 2.2 强制版本自增规约 (Agent Mandatory Action)
每次响应并完成用户的开发任务（在提交 Git 前），**必须**评估本次改动的影响范围并执行版本递增：

| 变更类型 | 说明 | 执行命令 | 示例 |
| :--- | :--- | :--- | :--- |
| **PATCH（修订号）** | Bug 修复、样式微调、文案修改、微小兼容调整 | `npm run bump:patch` | 2.1.0 $\to$ 2.1.1 |
| **MINOR（次版本）** | 新增功能、新增设置项、组件重构、交互大改版 | `npm run bump:minor` | 2.1.0 $\to$ 2.2.0 |
| **MAJOR（主版本）** | 底层架构重构、不兼容的数据结构变更、重大全站重写 | `npm run bump:major` | 2.1.0 $\to$ 3.0.0 |

> **提示**：也可以使用 `node scripts/bump.js <type>` 或直接在 `package.json` 修改版本号。

### 2.3 更新日志同步
执行版本自增后，**必须同步**在 `README.md` 的 `## 📝 最新更新记录` 顶部追加当前版本的详细更新要点。

---

## ✅ 3. 交付前验证规范 (Verification Before Completion)

AI Agent 在宣称代码修改完毕或向用户汇报前，**必须依次运行并确认以下验证命令通过**（遵循 Evidence Before Assertions 原则）：

```bash
# 1. 严格 TypeScript 类型检查（必须 0 错误）
npx tsc --noEmit

# 2. 生产环境 Vite 打包构建验证（必须 0 错误）
npm run build
```

---

## 📦 4. Git 提交与发布流程

1. 确认已执行版本自增（`package.json` 已更新）。
2. 确认 `README.md` 已记录更新日志。
3. 提交信息规范推荐：
   - 功能新增：`feat(vX.Y.Z): 描述功能内容`
   - 问题修复：`fix(vX.Y.Z): 描述修复内容`
   - 版本发布：`chore(release): vX.Y.Z`
4. 推送至远程分支：`git push origin main`（触发 Cloudflare Pages 自动构建上线）。

---

## 🎨 5. 交互与 UI 设计准则

1. **明暗模式兼容**：所有新增或修改的 UI 元素，必须完整适配深色模式（`dark:` 类名），文字、背景、边框、阴影对比度均需符合可访问性标准。
2. **弹窗标准交互**：所有模态窗口（Modal）必须支持：
   - 键盘 `Escape` 键按下自动关闭；
   - 点击遮罩背景区域自动关闭（且内部容器阻断 `e.stopPropagation()`）。
3. **侧边栏与布局**：折叠与展开需使用纯宽度与视口过渡，**切勿使用负外边距（如 `-ml-64`）** 以免导致主内容区产生负坐标偏移。
4. **单控制按钮原则**：展开/折叠等全局切换按钮在视口内同一时刻仅保留唯一的控制入口，杜绝冗余双图标。
