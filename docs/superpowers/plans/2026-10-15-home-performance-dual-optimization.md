# 首页 5000+ 海量书签双重极客性能优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现首页 React 级分类视口懒加载（Lazy Section Mount）与超长分类（>36 卡片）智能折叠展开，彻底化解 5000+ 书签全量渲染带来的 DOM 树与内存暴涨。

**Architecture:** 
1. 采用 `IntersectionObserver` 监控分类容器视口交叉，首屏前 2 个主分类默认同步挂载，其余在接近视口前 600px 后台按需挂载并保持常驻。
2. 每个分类及二级分类设置阈值 `CATEGORY_COLLAPSE_THRESHOLD = 36`，超量分类默认截断渲染并提供居中胶囊形「展开全部 / 收起」按钮。
3. `scrollToSection` 锚点跳转与拖拽排序模式（`isSortingMode`）自动联动强制挂载并完全展开对应分类。

**Tech Stack:** React 19, TypeScript, Lucide Icons (`ChevronDown`, `ChevronUp`), Tailwind CSS 3, IntersectionObserver API

## Global Constraints

- 严禁硬编码静态版本号，版本号单一数据源为 `package.json`
- 执行 `npm run bump:minor` 升级至 `v2.7.0`
- 所有改动必须通过 `npx tsc --noEmit` 与 `npm run build` 验证（0 错误）
- 深色模式完整兼容（`dark:` 类名）
- 点击展开/收起按钮阻止事件冒泡与默认行为

---

### Task 1: 引入分类折叠与视口懒加载状态及阈值常量

**Files:**
- Modify: `App.tsx:110-130`
- Modify: `App.tsx:1-10`

**Interfaces:**
- Produces: `CATEGORY_COLLAPSE_THRESHOLD: number = 36`
- Produces: `expandedCategoryIds: Set<string>`
- Produces: `toggleCategoryExpanded: (catId: string) => void`
- Produces: `mountedCategoryIds: Set<string>`
- Produces: `markCategoryMounted: (catId: string) => void`

- [ ] **Step 1: 在 `App.tsx` 顶部导入 `ChevronUp` 图标**
- [ ] **Step 2: 定义常量与状态 Hooks**
  ```tsx
  const CATEGORY_COLLAPSE_THRESHOLD = 36;
  // 记录手动展开的分类ID集合
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(() => new Set());
  // 记录已进入视口并挂载的分类ID集合
  const [mountedCategoryIds, setMountedCategoryIds] = useState<Set<string>>(() => new Set());
  ```
- [ ] **Step 3: 运行 `npx tsc --noEmit` 验证语法**

---

### Task 2: 实现分类视口懒加载观察器与锚点保活

**Files:**
- Modify: `App.tsx:1535-1560` (scrollToSection)
- Modify: `App.tsx:1900-1950` (首屏分类预挂载计算)

**Interfaces:**
- Consumes: `categories`, `mountedCategoryIds`
- Produces: 自动对首屏前 2 个分类及热门推荐执行初始化挂载
- Produces: `scrollToSection` 自动将目标分类加入 `mountedCategoryIds` 与 `expandedCategoryIds`

- [ ] **Step 1: 在 `categories` 就绪时，为前 2 个主分类默认添加挂载标记**
- [ ] **Step 2: 改造 `scrollToSection(targetId)`，提取目标分类 ID 并立即激活挂载与展开**
- [ ] **Step 3: 封装 `<LazyCategorySection>` 轻量监听容器，视口接近时自动触发挂载**
- [ ] **Step 4: 运行 `npx tsc --noEmit` 验证**

---

### Task 3: 实现超长分类（>36 卡片）智能折叠与展开收起组件

**Files:**
- Modify: `App.tsx:3000-3250` (主分类直属链接与二级分类独立网格渲染)

**Interfaces:**
- Consumes: `expandedCategoryIds`, `CATEGORY_COLLAPSE_THRESHOLD`, `isSortingMode`
- Produces: 折叠/展开胶囊按钮与截断渲染逻辑

- [ ] **Step 1: 在一级分类直属网格实现折叠逻辑（超过 36 个卡片截断，底部展示药丸按钮）**
- [ ] **Step 2: 在各二级分类独立网格同样实现折叠逻辑**
- [ ] **Step 3: 排序模式下自动完全展开（忽略截断，确保拖拽可排序所有项目）**
- [ ] **Step 4: 运行 `npx tsc --noEmit` 与 `npm run build` 验证**

---

### Task 4: 版本递增、更新日志记录与 Git 发布

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: 执行 `npm run bump:minor`（升级至 `v2.7.0`）**
- [ ] **Step 2: 在 `README.md` 顶部追加 `v2.7.0` 更新日志**
- [ ] **Step 3: 严格运行 `npx tsc --noEmit` 和 `npm run build`**
- [ ] **Step 4: 提交并推送到 `origin main`**
