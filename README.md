# Ubuntu Codex Workbench

Ubuntu Codex Workbench 是一个面向 Ubuntu 的 Electron 桌面应用，用于集中管理多个本地项目，并在应用右侧直接进入项目级 `codex` 终端工作区。它的目标很明确：减少在多个目录、多个终端和多个编辑器窗口之间来回切换的成本。

## 核心能力
- 左侧集中管理本地项目，支持添加、删除、收藏和搜索
- 每个项目维护独立终端会话，切换项目时不会串台
- 默认进入项目对应目录，并自动启动 `codex`
- 支持项目级复制粘贴、终端输出保留和完成提醒
- 启动时检查 `codex` 与 `code` 命令是否可用
- 支持打包为 Ubuntu `.deb` 桌面安装包

## 技术栈
- Electron
- Node.js
- `xterm.js`
- `node-pty`

## 本地开发
```bash
npm install
npm run dev:no-sandbox
```

如果当前环境的 Electron sandbox 权限正常，也可以直接执行：

```bash
npm run dev
```

## 测试
```bash
npm test
```

## 打包
生成 Ubuntu 安装包：

```bash
npm run dist:linux
```

打包产物默认输出到 `dist/`，例如：

```text
dist/ubuntu-codex-workbench_0.1.1_amd64.deb
```

## 安装运行
```bash
sudo apt install /path/to/ubuntu-codex-workbench_0.1.1_amd64.deb
```

安装后可在 Ubuntu 应用菜单中搜索 `Ubuntu Codex Workbench` 启动。

## 目录结构
```text
src/main/        主进程、IPC 与本地服务
src/renderer/    界面、交互与内嵌终端
tests/           单元测试
scripts/         自检、打包和辅助脚本
build/icons/     Linux 打包图标资源
dist/            构建产物
```

## 环境要求
- Ubuntu Linux
- Node.js 20+
- 已安装 `codex` CLI
- 可选：已安装 `code` 命令

如果缺少 `codex`，应用无法进入核心工作流；缺少 `code` 时，不影响终端工作流，但相关编辑器集成功能会受限。
