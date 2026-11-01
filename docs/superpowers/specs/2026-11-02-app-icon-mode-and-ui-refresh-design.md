# 手机 APP 图标模式与全站 UI 现代重构设计规范 (Design Spec)

**日期**: 2026-11-02  
**状态**: Approved by User  
**目标版本**: v2.10.0 (MINOR 递增)

---

## 1. 概述与背景

CloudNav 当前支持两种卡片展示模式：`simple`（简约）与 `detailed`（详情）。  
为了提供如同原生智能手机（iOS / Android）桌面启动器般的视觉体验与快速触达能力，本次升级将新增第三种展示模式 —— **手机 APP 图标模式 (`icon`)**。

同时，借助本次模式新增的契机，对 CloudNav 进行**全套卡片 UI 质感升级与全站 UI 现代化重塑**：
1. **新增手机 APP 图标模式**：大圆角 Squircle 拟态图标、彩色动态首字母渐变背景、角标系统（置顶/Emoji）、居中标题与自适应 4~10 列网格；
2. **重塑现有简约与详情卡片**：升级边框微光、暗黑墨色灰阶、精致排版与标签交互；
3. **全局 UI 现代重构**：顶部导航升级毛玻璃质感，视图切换器升级为 iOS 风格三态滑动胶囊，置顶区与分类区视觉质感全面优化。

---

## 2. 架构设计与数据模型变更

### 2.1 类型定义 (`types.ts`)
- 将 `SiteSettings` 的 `cardStyle` 从 `'simple' | 'detailed'` 升级为联合类型：
  ```typescript
  export type CardStyle = 'simple' | 'detailed' | 'icon';

  export interface SiteSettings {
    title: string;
    navTitle: string;
    favicon: string;
    cardStyle: CardStyle;
    passwordExpiryDays: number;
    openTarget?: '_blank' | '_self';
    showDescription?: boolean;
    showTags?: boolean;
    visibleCategoryCount?: number;
    categoryLinkLimit?: number;
  }
  ```
- **向下兼容性**：
  若本地或云端 KV 中存有历史数据，空值或非法值一律回退至默认值 `'detailed'`。

### 2.2 图标配色生成算法 (`getAppGradient`)
对于未配置自定义 Favicon 图标的书签，在图标模式下避免千篇一律的白底灰字，采用基于书签标题（`link.title`）的字符串哈希算法，动态映射至 10 套精心调校的 iOS 风格高雅微渐变：
- 柔和蓝紫 (`from-blue-500 to-indigo-600`)
- 活力珊瑚橙 (`from-orange-400 to-pink-500`)
- 翠玉薄荷 (`from-emerald-400 to-teal-600`)
- 极光青蓝 (`from-cyan-400 to-blue-500`)
- 优雅罗兰紫 (`from-purple-500 to-violet-600`)
- 暖日金晖 (`from-amber-400 to-orange-500`)
- 玫瑰茜红 (`from-rose-400 to-red-500`)
- 深邃暗空 (`from-slate-600 to-slate-800`)
- 晨曦天空 (`from-sky-400 to-indigo-500`)
- 青绿葱茏 (`from-lime-500 to-emerald-600`)

居中显示大写首字母，白色粗体文字与微文字阴影。

---

## 3. 卡片系统三态重构 (`LinkCard.tsx` / `SortableLinkCard`)

卡片支持三种 `cardStyle`，统一包裹在支持拖拽排序、批量选择与右键菜单的交互容器中：

### 3.1 手机 APP 图标模式 (`cardStyle === 'icon'`)
- **图标容器**：
  - 尺寸：`w-14 h-14`（56×56px，移动端在紧凑空间下自适应微调至 50~54px）；
  - 圆角：iOS 连续曲率圆角 `rounded-[18px]`；
  - 材质：具有精细的 1px 半透明微外边框（`border border-black/[0.06] dark:border-white/10`），柔和微投影（`shadow-sm hover:shadow-lg hover:shadow-blue-500/10 dark:hover:shadow-black/40`）；
  - 动效：悬停时轻微上浮与微缩放（`group-hover:-translate-y-1.5 group-hover:scale-105 active:scale-95 transition-all duration-200`）。
- **角标徽章 (Badges)**：
  - **Emoji 徽标**：右上角微徽章，半透明底色或浮动 pill，字号 `12px`；
  - **置顶徽章 (Pinned)**：左上角金色小星标（`Star`），标识优先推荐；
  - **批量选择勾选框**：右上角圆形 Checkmark 徽章，选中时呈高亮蓝色。
- **标题文字**：
  - 位于图标下方居中排列，字号 `text-[12.5px]`，字体权重 `font-medium`；
  - 文字颜色 `text-slate-700 dark:text-slate-200`，悬停时变为品牌高亮色；
  - 最大两行截断（`line-clamp-2`）或单行省略，保持网格整洁对齐；悬停提供原生 Title 或气泡 Tooltip。
- **排版定位**：
  - 纵向 Flex 居中流式布局（`flex flex-col items-center text-center p-2 rounded-2xl hover:bg-slate-100/60 dark:hover:bg-slate-800/60`）。

### 3.2 简约模式重构 (`cardStyle === 'simple'`)
- 横向精致小条目，高 `h-11`，图标尺寸 `34×34px`，`rounded-xl`；
- 标题单行截断，右侧保留 Emoji 与悬浮快捷编辑按钮；
- 边框与暗黑模式墨色微发光优化。

### 3.3 详情模式重构 (`cardStyle === 'detailed'`)
- 现代富内容卡片，图标 `44×44px`；
- 标题 + 2 行描述文本，底部展示标签药丸组（`#tag`），可一键点击标签进行聚合搜索；
- 优化的微渐变浮起投影。

---

## 4. 全局 UI 现代化与自适应网格排版 (`App.tsx`)

### 4.1 响应式网格列数自适应
根据当前 `siteSettings.cardStyle` 自动匹配列数规则：
- **图标模式 (`icon`)**：
  - 移动端（`< 640px`）：**严格 4 列**（`grid-cols-4`，还原真实手机原生主屏幕 4 列体验）；
  - 平板端（`640px ~ 1024px`）：**5 ~ 6 列**（`sm:grid-cols-5 md:grid-cols-6`）；
  - 桌面端（`1024px ~ 1440px`）：**7 ~ 8 列**（`lg:grid-cols-8 xl:grid-cols-9`）；
  - 超宽屏（`> 1440px`）：**10 列**（`2xl:grid-cols-10`）。
- **简约与详情模式 (`simple` / `detailed`)**：
  - `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`。

### 4.2 顶部导航栏与三态胶囊切换器
- **Header 玻璃拟态**：
  - `sticky top-0 z-40 backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/60 dark:border-slate-800/60`；
- **三态视图切换控制器**：
  - 包含 `简约`、`详情`、`图标` 三个按钮；
  - 具有滑动高亮白块（浅色模式）/ 深蓝高亮块（深色模式），点击即时平滑切换并持久化至设置。

### 4.3 收藏置顶与分类锚点视觉升级
- **置顶推荐栏 (Pinned)**：
  - 融入轻盈的微渐变背景与虚线边框外壳，如同 iOS 桌面负一屏的“快捷收藏小组件”；
- **分类标题与计数徽章**：
  - 升级分类左侧渐变亮色指示柱；
  - 计数徽章升级为圆润半透明药丸胶囊（`text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500`）；
- **全站配色调和**：
  - 消除生硬纯黑，全站深色模式采用深海深蓝灰与墨水灰阶（`bg-slate-950` 底色，`bg-slate-900` 容器，`bg-slate-850/slate-800` 卡片）。

---

## 5. 验收标准与测试规范

1. **功能完整性**：
   - 用户可在顶部导航直接点击“图标”按钮切换到手机 APP 图标模式；
   - 在图标模式下，网站标题、图标、未配置图标的首字母渐变、置顶金星、Emoji 徽标全部准确呈现；
   - 拖拽排序、批量选择、右键上下文菜单、快捷编辑在图标模式下运行正常无异常；
   - 切换到简约或详情模式，视觉与原有能力正常；
   - 在设置面板中修改默认显示模式，保存后生效。
2. **响应式与可访问性**：
   - 移动端（<640px）在图标模式下呈现标准的 4 列 App 启动器排列；
   - 深色模式对比度符合 WCAG AA 标准；
   - Modal 弹窗 Escape 退出与遮罩点击退出保持完好。
3. **工程质量标准**：
   - `npx tsc --noEmit` 0 错误；
   - `npm run build` 0 错误；
   - 版本按规范递增至 `v2.10.0` 并同步更新 `README.md`。
