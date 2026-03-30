# Ubuntu Codex Workbench 开发计划

## 目标
基于 PRD 实现 Ubuntu 下的 Codex Workbench MVP，优先解决多项目切换、Codex CLI 任务可视化和任务完成通知三个核心问题。

## 范围
本期只做 MVP：
- 项目新增、删除、收藏、搜索、最近打开排序
- 在 VS Code 中打开项目或 `.code-workspace`
- 在项目目录中执行 `codex "<prompt>"`
- 实时展示 stdout / stderr、开始结束时间、运行状态
- 任务完成或失败时触发系统通知

## 技术方案
- 桌面端：Electron
- 业务逻辑：Node.js 主进程服务
- 数据存储：JSON 文件，保存到 Electron `userData`
- 前端：原生 HTML/CSS/JavaScript，先保证可运行和低复杂度

## 开发阶段
1. 搭建工程骨架与 Electron 启动链路。
2. 实现主进程模块：`ProjectStore`、`TaskManager`、`CodexRunner`、`VSCodeService`、`NotificationService`。
3. 实现渲染层：项目列表、搜索收藏、运行面板、日志区、状态栏。
4. 打通 IPC，完成项目管理、任务执行和日志推送。
5. 补充 README、基础测试和错误处理。

## 验收标准
- 可以选择本地目录并保存为项目。
- 可以一键在 VS Code 中打开项目。
- 可以在目标目录运行 Codex CLI 并看到实时日志。
- 任务状态可见：`idle`、`running`、`success`、`failed`。
- 任务结束后出现系统通知。

## 当前实施策略
先实现单任务运行模型，避免并发复杂度；任务历史保留最近记录；当系统缺少 `code` 或 `codex` 命令时，在界面明确提示错误。

