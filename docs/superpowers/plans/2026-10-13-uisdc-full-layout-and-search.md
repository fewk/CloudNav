# UISDC 导航全景首页、聚合大搜索与锚点联动重构计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 CloudNav 升级为真正对标优设导航 (UISDC) 的全景首页流、沉浸式聚合大搜索 Banner、左侧锚点滚动联动 (ScrollSpy) 与高精度卡片视觉。

**Architecture:** 
1. 首页默认渲染所有已排序分类区块（含置顶热门区），各分类区块具备专属 `id="cat-${id}"`；
2. 左侧侧边栏由“独立切页”升级为“锚点导航与滚动视口高亮 (ScrollSpy)”；
3. 顶部加入 UISDC 风格的 Hero Search Banner，复刻蓝调沉浸式大搜索、连体 Tab 切换（修复切换 Bug）、橙色大按钮与下方热门标签微胶囊；
4. 卡片精修：移除显眼蓝边框、`h3` 标题 16px `#3c3c3c`、标签单行截断。

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Cloudflare Pages & KV

---

### Task 1: 卡片样式精修 (Link Card Styling Fixes)
**Files:**
- Modify: `App.tsx` (in `renderLinkCard` & `SortableLinkCard`)

- [ ] 移除 `hover:border-blue-400/60` 边框，改为无痕微边框或纯净背景阴影
- [ ] 网站标题调整为 `<h3>`，字体 `text-[16px]`，颜色 `#3c3c3c` (暗黑模式 `text-slate-100`)，`font-semibold`
- [ ] 网站标签容器改为单行排版 `flex flex-nowrap overflow-hidden gap-1.5 whitespace-nowrap`，超出截断

---

### Task 2: 沉浸式大搜索 Banner & 修复搜索引擎切换 Bug
**Files:**
- Modify: `App.tsx` (Hero Search Banner & Search State Handlers)

- [ ] 修复搜索 Tab 切换 Bug：
  - 点击 Tab 仅切换 `searchMode` 和 `selectedSearchSource`，绝不触发 `window.open`
  - 确保状态与本地存储正常同步
- [ ] 构建 Hero Search Banner：
  - 蓝天/插画渐变风格宽幅背景 Banner
  - 连体 Tab 切换：活跃 Tab 为白色圆角矩形，与下方白色搜索框无缝一体
  - 大尺寸白色输入框 + 一键清空 + 优设经典橙色触发大按钮（动态文字：`百度一下` / `站内搜索` / `Google 搜索`）
  - 输入框下方热门标签栏：提炼高频标签胶囊，点击一键全站检索

---

### Task 3: 首页全景分类流 & 左侧侧栏锚点滚动监听 (ScrollSpy)
**Files:**
- Modify: `App.tsx`

- [ ] 首页默认（非搜索模式）渲染全部分类区块：
  - `#pinned`: 热门推荐区块
  - `#cat-${id}`: 各分类依次排布的完整流式区块（标题指示条 + 图标 + 二级分类标签 + 书签网格）
- [ ] 搜索模式保留全局结果过滤视图
- [ ] 左侧侧栏改造：
  - 侧栏视觉对标优设导航
  - 点击分类平滑滚动至对应区块 (`scrollIntoView({ behavior: 'smooth' })`)
  - 内容区滚动监听 (ScrollSpy)，实时高亮当前可视分类

---

### Task 4: 编译验证、Cloudflare Pages 部署与 GitHub 推送
- [ ] `npm run build` 确保 0 报错
- [ ] `npm run deploy` 部署至 Cloudflare Pages 线上生产环境
- [ ] `git push origin main` 同步至 GitHub
