const fs = require("node:fs");
const { execFile } = require("node:child_process");
const { Notification } = require("electron");

function debugLog(message, meta = {}) {
  try {
    const line = `[${new Date().toISOString()}] ${message} ${JSON.stringify(meta)}\n`;
    fs.appendFileSync("/tmp/ubuntu-workbench-debug.log", line);
  } catch {}
}

class NotificationService {
  constructor(focusWindow) {
    this.focusWindow = focusWindow;
  }

  notifyTaskFinished(task, projectName) {
    const isSuccess = task.status === "success";
    this.showNotification({
      title: isSuccess ? "Codex 任务已完成" : "Codex 任务失败",
      body: `${projectName} · ${task.status}`,
    });
  }

  notifyTerminalTurnFinished(projectName) {
    this.showNotification({
      title: "Codex 已完成当前轮次",
      body: `${projectName} · 可以继续输入下一条指令`,
    });
  }

  showNotification({ title, body }) {
    debugLog("notify:request", { title, body, platform: process.platform });

    if (process.platform === "linux") {
      execFile("notify-send", [title, body], (error) => {
        if (error) {
          debugLog("notify:notify-send:error", { message: error.message });
        } else {
          debugLog("notify:notify-send:ok", { title });
        }
      });
    }

    if (!Notification.isSupported()) {
      debugLog("notify:electron:unsupported", { title });
      return;
    }

    const notification = new Notification({ title, body });
    notification.on("click", () => this.focusWindow());
    notification.show();
    debugLog("notify:electron:show", { title });
  }
}

module.exports = { NotificationService };
