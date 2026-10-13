# AI 网页深度抓取解析与标签体系 (Tags) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 利用 Cloudflare Workers 边缘能力（无 CORS 限制）实现真实网页元数据深度抓取，联动 AI 自动生成精准简介、推荐分类与智能标签，并在导航站中建立完整的标签体系 (Tags)，最后全面重构与更新 README 文档。

**Architecture:** 
1. **边缘抓取服务**：新增 `functions/api/scrape.ts`（Cloudflare Pages Function/Worker），直接在边缘端发起跨域 `fetch` 请求并解析真实网页的 `<title>`、`<meta description>`、正文文本、关键词和高清 Favicon。
2. **AI 智能分析引擎**：扩展 `services/geminiService.ts`，接收抓取的真实网页内容，生成精准中文简介、匹配/建议分类、以及推荐 2~4 个标签。
3. **标签系统 (Tags)**：在 `types.ts` 的 `LinkItem` 中增加 `tags?: string[]` 字段，在 `LinkModal.tsx` 中增加交互式标签管理与 AI 建议标签一键采纳，在卡片中优雅展示，并在搜索中支持标签精准匹配。
4. **README 文档清理与重构**：清理过时图文和失效指引，全面更新最新功能（自主表情、长久免密、AI 真实网页抓取、标签系统、最新一键部署命令）。

**Tech Stack:** TypeScript, React, Tailwind CSS, Cloudflare Pages Functions (Workers Runtime), Vite.

---

### Task 1: 数据模型扩展与抓取接口构建 (`functions/api/scrape.ts` & `types.ts`)

**Files:**
- Modify: `types.ts:1-25`
- Create: `functions/api/scrape.ts`

**Interfaces:**
- Produces: `POST /api/scrape` 返回 `{ title: string, description: string, icon: string, keywords: string[], bodyPreview: string }`
- Produces: `LinkItem.tags?: string[]`

- [ ] **Step 1: 在 `types.ts` 中为 `LinkItem` 增加 `tags?: string[]` 字段**
- [ ] **Step 2: 创建 `functions/api/scrape.ts` 边缘抓取函数**
  - 实现无 CORS 限制的网页 HTML 拉取（支持超时防护与 UA 头伪装）
  - 正则/HTML 流式提取 `<title>`、`og:title`、`<meta name="description">`、`og:description`、`<meta name="keywords">`、`<link rel="icon">` 和正文文字摘要
  - 图标自动转换为绝对 URL（相对路径自动补全域名）
- [ ] **Step 3: 测试并验证本地构建**
  - 运行 `npm run build` 确保类型无误

---

### Task 2: AI 服务升级：基于真实网页内容的深度摘要、分类与建议标签生成 (`services/geminiService.ts`)

**Files:**
- Modify: `services/geminiService.ts`

**Interfaces:**
- Consumes: Scraped metadata from `/api/scrape`
- Produces: `analyzeLinkWithAI(metadata, categories, config)` 返回 `{ title?: string, description: string, suggestedCategoryId?: string, suggestedCategoryName?: string, tags: string[] }`

- [ ] **Step 1: 在 `services/geminiService.ts` 中实现统一的提示词模板与 JSON 格式化输出**
  - Prompt 注入真实网页的标题、官方描述与正文前 800 字
  - 引导 AI 输出：① 精准中文短简介（15~30字）；② 最贴合的现有分类 ID 或新建议分类；③ 2~4 个语义相关的技术/领域标签
- [ ] **Step 2: 兼容 Gemini SDK 与 OpenAI Compatible (DeepSeek/GPT/Claude)**
  - 解析模型返回的 JSON，提供优雅的 Fallback 容错机制

---

### Task 3: 前端交互改造：AI 一键全自动解析与标签管理 UI (`components/LinkModal.tsx`)

**Files:**
- Modify: `components/LinkModal.tsx`

**Interfaces:**
- Consumes: `/api/scrape` and `analyzeLinkWithAI`
- Produces: Link saving payload with `tags: string[]`

- [ ] **Step 1: 新增标签选择与管理组件**
  - 支持查看当前已选标签（支持点击 × 移除）
  - 支持手动输入标签（回车或逗号快速添加）
- [ ] **Step 2: 重构 AI 一键填充按钮（“AI 智能解析”）**
  - 用户粘贴 URL 后，点击“AI 智能解析”：
    1. 调用 `/api/scrape` 抓取真实元数据
    2. 自动回填标题与高清图标
    3. 调用 AI 分析生成精准简介、推荐分类与建议标签
    4. 将建议标签以可选气泡方式呈现在标签栏下方，点击即可一键添加
- [ ] **Step 3: 保存与重置状态包含 `tags`**

---

### Task 4: 首页卡片展示与标签搜索联动 (`App.tsx`)

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: 在卡片组件中渲染标签徽标**
  - 在详情版视图和极简版视图中渲染细小精致的 Tag 徽标
  - 鼠标悬停标签时高亮展示
- [ ] **Step 2: 增强搜索匹配逻辑**
  - 搜索框输入关键词时，同时匹配 `link.tags`，输入标签名称可快速召回所有关联网站
- [ ] **Step 3: 标签点击联动**
  - 点击卡片上的标签，可自动将搜索框填充为该标签名，快速过滤同类站点

---

### Task 5: 全面重构并同步更新 README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 清理 README 中陈旧、过时的部分**
  - 清理旧版本的历史更新记录赘述
  - 修正部署指引为最新现代模式（说明 Pages + Functions 自动托管）
- [ ] **Step 2: 撰写最新版本亮点特性**
  - ✨ **边缘 AI 真实网页深度解析**：粘贴 URL 自动抓取网页并由 AI 智能生成简介与分类
  - 🏷️ **标签体系 (Tags)**：支持多维度标签与 AI 智能推荐标签，多条件精准检索
  - 🌟 **自主表情符号**：支持 ⭐/🔥/❤️ 与自定义表情，卡片直接渲染与右键极速打标
  - 🔒 **全天候免密登录**：修复旧版 7 天假值 bug，支持登录时直接勾选“永不退出直至修改密码”，改密后自动呼出弹窗
  - 🚀 **Wrangler 一键极速部署**：提供 `npm run deploy` 十几秒自动构建上线指引

---

### Task 6: 构建、部署至 Cloudflare Pages 并提交推送至 GitHub

- [ ] **Step 1: 运行 `npm run build` 确保编译成功**
- [ ] **Step 2: 执行 `npm run deploy` 部署至 Cloudflare Pages**
- [ ] **Step 3: 使用 curl 验证线上服务状态**
- [ ] **Step 4: Git 提交并推送至 GitHub 仓库 `fewk/CloudNav:main`**
