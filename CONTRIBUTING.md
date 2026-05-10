# 贡献指南

感谢关心这个项目！

## 开发环境

```bash
git clone https://github.com/<your-name>/deepseek-monitor.git
cd deepseek-monitor
npm install
npm run electron:dev
```

## 代码规范

- 语言：TypeScript 严格模式
- 框架：React 18 函数式组件 + hooks
- 样式：TailwindCSS，复用已有的 `cream` / `warm` / `accent` 色板
- 提交：Conventional Commits（`feat:` / `fix:` / `docs:` / `refactor:` / `chore:`）

## 分支策略

- `main`：稳定分支，发布打包均从此分支
- 功能开发：从 `main` 拉新分支，命名 `feat/xxx` 或 `fix/xxx`，PR 合回 `main`

## 平台接口适配

DeepSeek 平台内部接口可能随时变动。如果你发现返回结构变了：

1. 启动应用 → 设置页 → 点「诊断接口」
2. 导航到用量页面让数据加载
3. 关闭窗口后在诊断列表里找到新接口的「预览」
4. 在 `electron/api.ts` 的 `normalizeDsNative()` 中增加新字段识别
5. 提交 PR，附上新旧结构对比

## Issue 规范

- **Bug**：请贴出复现步骤 + 诊断接口的「预览」截图（可手动打码 ID 等敏感字段）
- **禁止**：在 Issue 里贴完整 API Key 或 Cookie

## PR Checklist

- [ ] `npm run electron:dev` 能正常启动
- [ ] `npx tsc --noEmit` 无 TypeScript 错误
- [ ] `npx tsc -p electron/tsconfig.json` 无错误
- [ ] UI 改动附截图
- [ ] 如涉及新依赖，说明必要性
