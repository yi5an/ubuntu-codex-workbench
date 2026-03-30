const fs = require("node:fs");

function debugLog(message, meta = {}) {
  try {
    const line = `[${new Date().toISOString()}] ${message} ${JSON.stringify(meta)}\n`;
    fs.appendFileSync("/tmp/ubuntu-workbench-debug.log", line);
  } catch {}
}

class NotificationService {
  constructor(focusWindow) {
    this.focusWindow = focusWindow;
    this.onNotify = null;
  }

  notifyTaskFinished(task, projectName) {
    const isSuccess = task.status === "success";
    this.showNotification({
      title: isSuccess ? "Codex 任务已完成" : "Codex 任务失败",
      body: `${projectName} · ${task.status}`,
      projectName,
    });
  }

  notifyTerminalTurnFinished(projectName, projectId) {
    this.showNotification({
      title: "Codex 已完成当前轮次",
      body: `${projectName} · 可以继续输入下一条指令`,
      projectName,
      projectId,
    });
  }

  showNotification({ title, body, projectName = null, projectId = null }) {
    debugLog("notify:request", { title, body, projectName, projectId, platform: process.platform });

    if (typeof this.onNotify === "function") {
      this.onNotify({
        title,
        body,
        projectName,
        projectId,
        timestamp: Date.now(),
      });
    }
  }
}

module.exports = { NotificationService };
