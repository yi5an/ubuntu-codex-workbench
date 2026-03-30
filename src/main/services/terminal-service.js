const os = require("node:os");
const fs = require("node:fs");
const pty = require("node-pty");
const { spawnSync } = require("node:child_process");

function debugLog(message, meta = {}) {
  try {
    const line = `[${new Date().toISOString()}] ${message} ${JSON.stringify(meta)}\n`;
    fs.appendFileSync("/tmp/ubuntu-workbench-debug.log", line);
  } catch {}
}

class TerminalService {
  constructor(sendToRenderer, notificationService, options = {}) {
    this.sendToRenderer = sendToRenderer;
    this.notificationService = notificationService;
    this.getSettings = options.getSettings || (() => ({ proxy: { enabled: false, url: "" } }));
    this.sessions = new Map();
  }

  createSession(sessionId, cwd, projectName, options = {}) {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.cwd = cwd;
      existing.projectName = projectName;
      existing.projectId = options.projectId || existing.projectId;
      return {
        sessionId,
        shell: existing.shell,
        mode: existing.mode,
        cwd,
        home: os.homedir(),
      };
    }

    const proxyEnv = this.buildProxyEnv();
    const codexCommand = this.getCodexCommand();
    const launchCodex = options.launchCodex !== false && this.hasCodexCommand();
    const shell = process.env.SHELL || "/usr/bin/zsh";
    const executable = launchCodex ? codexCommand : shell;
    const args = launchCodex ? [] : ["-l"];
    const mode = launchCodex ? "codex" : "shell";

    const ptyProcess = pty.spawn(executable, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 36,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        ...proxyEnv,
      },
    });

    const session = {
      sessionId,
      shell,
      mode,
      cwd,
      projectName,
      projectId: options.projectId || null,
      ptyProcess,
      codex: {
        active: launchCodex,
        booting: launchCodex,
        pendingPrompt: false,
        sawOutputSinceSubmit: false,
        inputBuffer: "",
        recentText: "",
        completionTimer: null,
      },
    };

    this.sessions.set(sessionId, session);
    ptyProcess.onData((data) => {
      this.trackCodexOutput(session, data);
      this.sendToRenderer("terminal:data", { sessionId, data });
    });
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.clearCompletionTimer(session);
      this.sendToRenderer("terminal:exit", { sessionId, exitCode, signal });
      this.sessions.delete(sessionId);
    });

    return {
      sessionId,
      shell,
      mode,
      cwd,
      home: os.homedir(),
    };
  }

  sendInput(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("终端会话不存在");
    }

    this.trackCodexInput(session, data);
    session.ptyProcess.write(data);
  }

  resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.ptyProcess.resize(Math.max(40, cols), Math.max(12, rows));
  }

  runCommand(sessionId, command) {
    const session = this.sessions.get(sessionId);
    if (session && String(command || "").trim() === "codex") {
      session.codex.active = true;
      session.codex.booting = true;
      session.codex.pendingPrompt = false;
      session.codex.sawOutputSinceSubmit = false;
      session.codex.inputBuffer = "";
      session.codex.recentText = "";
    }

    this.sendInput(sessionId, `${command}\r`);
  }

  disposeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    this.clearCompletionTimer(session);
    session.ptyProcess.kill();
    this.sessions.delete(sessionId);
    return true;
  }

  disposeAll() {
    for (const sessionId of this.sessions.keys()) {
      this.disposeSession(sessionId);
    }
  }

  trackCodexInput(session, data) {
    if (!session.codex.active) {
      return;
    }

    const text = String(data || "");
    for (const char of text) {
      if (char === "\u0003") {
        this.clearCompletionTimer(session);
        session.codex.pendingPrompt = false;
        session.codex.sawOutputSinceSubmit = false;
        session.codex.inputBuffer = "";
        continue;
      }

      if (char === "\u007f") {
        session.codex.inputBuffer = session.codex.inputBuffer.slice(0, -1);
        continue;
      }

      if (char === "\r") {
        if (!session.codex.booting && session.codex.inputBuffer.trim()) {
          session.codex.pendingPrompt = true;
          session.codex.sawOutputSinceSubmit = false;
          this.clearCompletionTimer(session);
          debugLog("codex:prompt:submitted", {
            projectName: session.projectName,
            prompt: session.codex.inputBuffer.trim().slice(0, 120),
          });
        }
        session.codex.inputBuffer = "";
        continue;
      }

      if (char >= " " && char !== "\u001b") {
        session.codex.inputBuffer += char;
      }
    }
  }

  trackCodexOutput(session, data) {
    if (!session.codex.active) {
      return;
    }

    const text = this.stripAnsi(String(data || "")).replaceAll("\r", "\n");
    session.codex.recentText = `${session.codex.recentText}${text}`.slice(-6000);

    if (session.codex.pendingPrompt && text.trim()) {
      session.codex.sawOutputSinceSubmit = true;
      this.scheduleCompletionCheck(session);
    }

    const idleMatch = this.looksLikeCodexIdle(session.codex.recentText);
    if (!idleMatch) {
      return;
    }

    debugLog("codex:idle:detected", {
      projectName: session.projectName,
      booting: session.codex.booting,
      pendingPrompt: session.codex.pendingPrompt,
      sawOutputSinceSubmit: session.codex.sawOutputSinceSubmit,
      match: idleMatch,
    });

    if (session.codex.booting) {
      debugLog("codex:idle:boot-finished", { projectName: session.projectName });
      session.codex.booting = false;
      return;
    }

    if (session.codex.pendingPrompt && session.codex.sawOutputSinceSubmit) {
      debugLog("codex:idle:notify", { projectName: session.projectName });
      this.notificationService?.notifyTerminalTurnFinished(
        session.projectName || "当前项目",
        session.projectId || null
      );
      this.clearCompletionTimer(session);
      session.codex.pendingPrompt = false;
      session.codex.sawOutputSinceSubmit = false;
    }
  }

  looksLikeCodexIdle(text) {
    const tail = String(text || "").slice(-1200);
    const hasPromptLine =
      /(?:^|\n)\s*[›❯>]\s.*$/m.test(tail) ||
      /(?:^|\n)\s*[›❯>]\s*$/m.test(tail);
    const hasStatusLine =
      /gpt-[^\n]*\d+% left/i.test(tail) ||
      /(?:^|\n)\s*model:[^\n]*$/im.test(tail);

    if (!hasPromptLine || !hasStatusLine) {
      return false;
    }

    return {
      hasPromptLine,
      hasStatusLine,
    };
  }

  stripAnsi(value) {
    return value.replace(
      // eslint-disable-next-line no-control-regex
      /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007]*(?:\u0007|\u001b\\)|\u001b[@-_]/g,
      ""
    );
  }

  buildProxyEnv() {
    const settings = this.getSettings();
    const proxyUrl = String(settings?.proxy?.url || "").trim();

    if (!settings?.proxy?.enabled || !proxyUrl) {
      return {};
    }

    return {
      HTTP_PROXY: proxyUrl,
      HTTPS_PROXY: proxyUrl,
      ALL_PROXY: proxyUrl,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl,
      all_proxy: proxyUrl,
    };
  }

  hasCodexCommand() {
    const configuredPath = String(this.getSettings()?.codex?.path || "").trim();
    if (configuredPath) {
      const result = spawnSync(configuredPath, ["--version"], {
        stdio: "ignore",
        timeout: 5000,
      });
      return result.status === 0;
    }

    const result = spawnSync("bash", ["-lc", "command -v codex >/dev/null 2>&1"], {
      stdio: "ignore",
    });
    return result.status === 0;
  }

  getCodexCommand() {
    return String(this.getSettings()?.codex?.path || "").trim() || "codex";
  }

  scheduleCompletionCheck(session) {
    this.clearCompletionTimer(session);
    session.codex.completionTimer = setTimeout(() => {
      session.codex.completionTimer = null;
      if (!session.codex.pendingPrompt || !session.codex.sawOutputSinceSubmit) {
        return;
      }

      debugLog("codex:idle:timer-notify", { projectName: session.projectName });
      this.notificationService?.notifyTerminalTurnFinished(
        session.projectName || "当前项目",
        session.projectId || null
      );
      session.codex.pendingPrompt = false;
      session.codex.sawOutputSinceSubmit = false;
    }, 3500);
  }

  clearCompletionTimer(session) {
    if (!session?.codex?.completionTimer) {
      return;
    }
    clearTimeout(session.codex.completionTimer);
    session.codex.completionTimer = null;
  }
}

module.exports = { TerminalService };
