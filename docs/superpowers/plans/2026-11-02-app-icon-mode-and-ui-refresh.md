# 手机 APP 图标模式与全站 UI 现代重构实施计划 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 CloudNav 新增类似智能手机桌面的“图标模式 (`icon`)”，同时将全套卡片（简约、详情、图标）与全站 UI 进行现代化重塑与精致质感升级。

**Architecture:** 
将显示模式从二元扩展为三态 (`CardStyle = 'simple' | 'detailed' | 'icon'`)；在 `LinkCard.tsx` 与 `SortableLinkCard` 中构建高质量的 56px Squircle 应用图标网格与角标系统，未定义图标时采用标题哈希动态生成的 iOS 柔和微渐变色；顶栏打造三态滑动胶囊切换器与毛玻璃质感，网格按模式自适应 4 列（手机桌面）至 10 列（桌面 Launchpad）。

**Tech Stack:** React 19, TypeScript, Tailwind CSS 3, Vite 6, Lucide Icons, @dnd-kit.

## Global Constraints

- 所有文件必须保证强类型，严禁跳过 TypeScript 类型检查（`npx tsc --noEmit` 0 错误）。
- 深色模式必须完整兼容高对比度与墨色灰阶美学（`dark:` 类）。
- 所有模态弹窗保持 Escape 与遮罩点击关闭能力，禁止引入负外边距破坏视口。
- 遵循单一数据源原则，版本号唯一来源为 `package.json`，完成时执行 `npm run bump:minor` (v2.10.0) 并同步 `README.md`。

---

### Task 1: 数据模型升级与渐变调色板工具函数

**Files:**
- Modify: `types.ts`
- Create/Modify: `services/colorUtils.ts` (或在 `types.ts` 导出辅助函数)

**Interfaces:**
- Consumes: `LinkItem`, `SiteSettings`
- Produces: 
  - `export type CardStyle = 'simple' | 'detailed' | 'icon';`
  - `export function getAppGradient(title: string): { bgGradient: string; textColor: string };`

- [ ] **Step 1: 更新 `types.ts` 中的 `CardStyle` 与 `SiteSettings`**
  - 定义 `export type CardStyle = 'simple' | 'detailed' | 'icon';`
  - 将 `SiteSettings.cardStyle` 字段类型更新为 `CardStyle`。
- [ ] **Step 2: 创建基于字符串哈希的 iOS 灵动渐变色彩生成器**
  - 在 `services/colorUtils.ts` 中实现 `getAppGradient(seed: string)`，内置 10 组高雅渐变色类名（如 `from-blue-500 to-indigo-600`、`from-emerald-400 to-teal-600`、`from-orange-400 to-pink-500` 等）；
  - 稳定输出对应的渐变 Tailwind 样式类与文字颜色。
- [ ] **Step 3: 运行 TypeScript 验证**
  - 运行 `npx tsc --noEmit` 确保无编译类型报错。

---

### Task 2: 核心卡片组件三态重塑 (`components/LinkCard.tsx`)

**Files:**
- Modify: `components/LinkCard.tsx`

**Interfaces:**
- Consumes: `LinkItem`, `CardStyle`, `getAppGradient`
- Produces: 统一的 `<LinkCard />`，支持 `cardStyle?: CardStyle`（兼容保留 `isDetailedView?: boolean` 避免旧调用破坏）。

- [ ] **Step 1: 扩展 `LinkCardProps` 接口**
  - 支持 `cardStyle?: CardStyle;`，在没有传递时根据 `isDetailedView` 自动映射为 `'detailed' | 'simple'`，保持 100% 向下兼容。
- [ ] **Step 2: 构建“手机 APP 图标模式 (`icon`)”卡片布局**
  - 纵向 Flex 居中容器（`flex flex-col items-center text-center p-2 rounded-2xl`）；
  - **56×56px Squircle 图标**（`rounded-[18px]`，微边框与环境投影，悬停上浮与轻触微缩放）；
  - 图标若缺失，调用 `getAppGradient(link.title)` 呈现渐变底色和大写首字母；
  - **角标系统**：右上角 Emoji 微徽标、左上角置顶星标（Pinned）、批量模式下的选择圆形 Checkmark；
  - **标题文字**：居中对齐，`text-[12.5px] font-medium`，单/双行智能省略，悬停颜色渐变；
  - 悬停浮现快捷编辑齿轮按钮。
- [ ] **Step 3: 现代化精细重构“简约模式 (`simple`)”与“详情模式 (`detailed`)”**
  - 简约模式：升级为横向轻条目，平滑圆角图标与呼吸感边框；
  - 详情模式：升级为现代知识卡片，优化 2 行摘要文字与药丸 Tag 标签排版；
  - 统一全模式的浅色/深色主题光影与微发光边框。
- [ ] **Step 4: 运行 TypeScript 验证**
  - 运行 `npx tsc --noEmit` 确保无错误。

---

### Task 3: 设置面板支持三态默认视图配置 (`components/SettingsModal.tsx`)

**Files:**
- Modify: `components/SettingsModal.tsx`

**Interfaces:**
- Consumes: `SiteSettings`, `CardStyle`
- Produces: 带有“简约”、“详情”、“图标”三选一的直观卡片风格配置项。

- [ ] **Step 1: 升级设置面板中卡片风格的选择交互**
  - 在“基础设置”或显示设置区，展示 3 个选项卡片（图标模式、简约模式、详情模式）；
  - 增加对应示意图标与简短说明（如“手机 APP 风格：大图标+居中标题”）；
  - 绑定 `cardStyle: 'simple' | 'detailed' | 'icon'` 并支持保存持久化。
- [ ] **Step 2: 运行 TypeScript 验证**
  - 运行 `npx tsc --noEmit` 确保类型无误。

---

### Task 4: 全局 UI 现代化、三态胶囊切换器与自适应网格 (`App.tsx`)

**Files:**
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `LinkCard`, `CardStyle`, `getAppGradient`
- Produces: 现代化的全局 Header、三态滑动切换器、自适应列数网格、现代化置顶组件与分类锚点。

- [ ] **Step 1: 升级 `SortableLinkCard` 支持三态展示与拖拽反馈**
  - 将 `SortableLinkCard` 内部结构与 `LinkCard` 保持同步，支持 `cardStyle`；
  - 图标模式在拖拽中支持阴影加深与平滑位移。
- [ ] **Step 2: 升级顶部导航栏与视图切换器 (Tri-mode Switcher)**
  - 顶部 Header 添加 `backdrop-blur-md bg-white/85 dark:bg-slate-900/85` 毛玻璃质感；
  - 切换器从 2 按钮升级为 3 选项胶囊切换控制器（`简约`、`详情`、`图标`）；
  - 激活选项带白色/深色悬浮阴影块与平滑渐变过度；
  - 将 `handleViewModeChange` 参数类型扩展为 `(cardStyle: CardStyle) => void`。
- [ ] **Step 3: 改造全站卡片网格响应式列数矩阵**
  - 在 `CollapsibleLinkGrid`、搜索结果网格、置顶网格与二级分类网格中：
    - 当 `cardStyle === 'icon'` 时，采用专属高密度网格：`grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 2xl:grid-cols-10 gap-3 sm:gap-4`；
    - 当 `cardStyle !== 'icon'` 时，保持原有的 2~6 列宽卡片网格；
  - 确保移动端（手机屏幕）在图标模式下呈现精准且经典的 **4 列手机 APP 桌面图标排列**。
- [ ] **Step 4: 置顶区与分类标题视觉质感重塑**
  - 置顶推荐区添加柔和的微渐变卡片外壳，呈现 iOS 桌面组件感；
  - 分类标题左侧指示条与计数徽章胶囊化打磨；
  - 优化深色模式整体底色协调度（深海墨韵蓝灰阶）。
- [ ] **Step 5: 运行 TypeScript 验证**
  - 运行 `npx tsc --noEmit` 确保全站 0 错误。

---

### Task 5: 交付验证、版本递增 (v2.10.0) 与更新日志同步

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: 严格编译与构建验证**
  - 运行 `npx tsc --noEmit` 确认无类型报错；
  - 运行 `npm run build` 确认 Vite 生产环境打包顺利通过。
- [ ] **Step 2: 执行版本递增**
  - 运行 `npm run bump:minor`（自增至 `v2.10.0`）；
  - 确认 `package.json` 版本号为 `2.10.0`。
- [ ] **Step 3: 记录 `README.md` 更新日志**
  - 在 `README.md` 的“最新更新记录”顶部追加 `v2.10.0` 的详细更新亮点（新增手机 APP 图标模式、全套卡片与全局 UI 现代化重塑、4~10 列自适应网格等）。
- [ ] **Step 4: Git 提交所有变更**
  - 按照规范执行 `git add .` 与 `git commit -m "feat(v2.10.0): 新增手机APP图标显示模式并全面重构升级全站现代UI"`。
