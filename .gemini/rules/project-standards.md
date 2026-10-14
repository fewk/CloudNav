# CloudNav 项目开发与版本规范 (Antigravity Rule)

作为在 CloudNav 项目中工作的 AI Assistant，你必须严格遵循以下规约：

## 1. 语义化版本号管理（强制要求）
- 本项目版本号唯一真理来源为 `package.json` 中的 `version` 字段，严禁在组件或 TSX 中硬编码版本号。
- 每次完成用户需求或修复 Bug 时，必须在提交前执行版本递增：
  - Bug 修复 / 样式微调：运行 `npm run bump:patch` (例如 2.1.0 -> 2.1.1)
  - 新功能 / 页面改版：运行 `npm run bump:minor` (例如 2.1.0 -> 2.2.0)
  - 架构重大升级：运行 `npm run bump:major` (例如 2.1.0 -> 3.0.0)
- 递增版本后，同步在 `README.md` 的“最新更新记录”板块追加说明。

## 2. 交付前严格验证
- 每次提出交付前，必须执行：
  1. `npx tsc --noEmit`
  2. `npm run build`
- 确认退出码为 0、无任何 TypeScript 类型或构建错误后再提交 Git 并向用户汇报。

## 3. UI 交互体验守则
- 弹窗必须支持 ESC 键与点击暗色背景关闭。
- 侧边栏折叠严禁使用负外边距（避免主内容区向左负偏移）。
- 明暗主题 100% 深度适配。
