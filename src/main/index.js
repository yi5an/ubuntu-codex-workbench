const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { ProjectStore } = require("./services/project-store");
const { CodexRunner } = require("./services/codex-runner");
const { VSCodeService } = require("./services/vscode-service");
const { NotificationService } = require("./services/notification-service");
const { TaskManager } = require("./services/task-manager");
const { EnvironmentService } = require("./services/environment-service");
const { TerminalService } = require("./services/terminal-service");

let mainWindow;
let projectStore;
let taskManager;
let vscodeService;
let environmentService;
let terminalService;

function debugLog(message, meta = {}) {
  try {
    const line = `[${new Date().toISOString()}] ${message} ${JSON.stringify(meta)}\n`;
    fs.appendFileSync("/tmp/ubuntu-workbench-debug.log", line);
  } catch {}
}

app.setName("ubuntu-codex-workbench");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#0b1020",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    debugLog("renderer:console", { level, message, line, sourceId });
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    debugLog("renderer:gone", details);
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    debugLog("renderer:did-fail-load", { errorCode, errorDescription, validatedURL });
  });
  mainWindow.webContents.on("did-finish-load", () => {
    setTimeout(async () => {
      try {
        const metrics = await mainWindow.webContents.executeJavaScript(`
          (() => {
            const host = document.querySelector('#terminal-host');
            const xterm = document.querySelector('.xterm');
            const screen = document.querySelector('.xterm-screen');
            const canvas = document.querySelector('.xterm-screen canvas');
            const viewport = document.querySelector('.xterm-viewport');
            return {
              host: host ? {
                width: host.clientWidth,
                height: host.clientHeight,
              } : null,
              xterm: xterm ? {
                width: xterm.clientWidth,
                height: xterm.clientHeight,
              } : null,
              screen: screen ? {
                width: screen.clientWidth,
                height: screen.clientHeight,
                textLength: screen.textContent.length,
                htmlSample: screen.innerHTML.slice(0, 300),
              } : null,
              canvas: canvas ? {
                width: canvas.width,
                height: canvas.height,
                styleWidth: canvas.style.width,
                styleHeight: canvas.style.height,
              } : null,
              viewport: viewport ? {
                width: viewport.clientWidth,
                height: viewport.clientHeight,
              } : null,
              rows: (() => {
                const rows = document.querySelector('.xterm-rows');
                if (!rows) {
                  return null;
                }
                const style = getComputedStyle(rows);
                return {
                  childCount: rows.children.length,
                  textLength: rows.textContent.length,
                  htmlSample: rows.innerHTML.slice(0, 500),
                  color: style.color,
                  opacity: style.opacity,
                  visibility: style.visibility,
                  display: style.display,
                };
              })(),
            };
          })();
        `);
        debugLog("renderer:dom-metrics", metrics);
      } catch (error) {
        debugLog("renderer:dom-metrics:error", { message: error.message });
      }
    }, 2000);
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

function focusMainWindow() {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function getState() {
  return {
    projects: projectStore.getProjects(),
    tasks: projectStore.getTasks(),
    currentTask: taskManager.getCurrentTask(),
    environment: environmentService.inspect(),
  };
}

function broadcastState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("state:updated", getState());
}

function sendRendererEvent(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (channel === "terminal:data" || channel === "terminal:exit") {
    debugLog(channel, {
      sessionId: payload.sessionId,
      size: payload.data ? String(payload.data).length : 0,
      exitCode: payload.exitCode,
      signal: payload.signal,
    });
  }
  mainWindow.webContents.send(channel, payload);
}

function registerIpc() {
  ipcMain.handle("state:get", async () => getState());

  ipcMain.handle("project:pick", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const project = projectStore.addProject(result.filePaths[0]);
    broadcastState();
    return project;
  });

  ipcMain.handle("project:remove", async (_event, projectId) => {
    projectStore.removeProject(projectId);
    broadcastState();
    return true;
  });

  ipcMain.handle("project:favorite", async (_event, projectId) => {
    projectStore.toggleFavorite(projectId);
    broadcastState();
    return true;
  });

  ipcMain.handle("project:open", async (_event, projectId) => {
    const project = projectStore.markOpened(projectId);
    await vscodeService.openProject(project);
    broadcastState();
    return true;
  });

  ipcMain.handle("task:run", async (_event, payload) => {
    const { projectId, prompt } = payload;
    const normalizedPrompt = String(prompt || "").trim();
    if (!normalizedPrompt) {
      throw new Error("请输入任务 Prompt");
    }

    const project = projectStore.markOpened(projectId);
    await taskManager.runTask(project, normalizedPrompt);
    broadcastState();
    return true;
  });

  ipcMain.handle("task:stop", async () => {
    const stopped = taskManager.stopTask();
    broadcastState();
    return stopped;
  });

  ipcMain.handle("terminal:create", async (_event, payload) => {
    const { sessionId, projectId } = payload;
    const project = projectStore.markOpened(projectId);
    debugLog("terminal:create", { sessionId, projectId, path: project.path });
    const terminal = terminalService.createSession(sessionId, project.path, project.name);
    broadcastState();
    return terminal;
  });

  ipcMain.handle("terminal:input", async (_event, payload) => {
    terminalService.sendInput(payload.sessionId, payload.data);
    return true;
  });

  ipcMain.handle("terminal:resize", async (_event, payload) => {
    debugLog("terminal:resize", payload);
    terminalService.resize(payload.sessionId, payload.cols, payload.rows);
    return true;
  });

  ipcMain.handle("terminal:run-command", async (_event, payload) => {
    debugLog("terminal:run-command", payload);
    terminalService.runCommand(payload.sessionId, payload.command);
    return true;
  });

  ipcMain.handle("terminal:dispose", async (_event, payload) => {
    return terminalService.disposeSession(payload.sessionId);
  });
}

app.whenReady().then(() => {
  projectStore = new ProjectStore(path.join(app.getPath("userData"), "workbench-data.json"));
  vscodeService = new VSCodeService();
  environmentService = new EnvironmentService();
  const notificationService = new NotificationService(focusMainWindow);
  terminalService = new TerminalService(sendRendererEvent, notificationService);
  taskManager = new TaskManager(projectStore, new CodexRunner(), notificationService);
  taskManager.on("updated", broadcastState);

  registerIpc();
  createWindow();
});

app.on("window-all-closed", () => {
  if (terminalService) {
    terminalService.disposeAll();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    focusMainWindow();
  }
});
