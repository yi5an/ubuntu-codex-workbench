const os = require("node:os");
const fs = require("node:fs");
const pty = require("node-pty");

function debugLog(message, meta = {}) {
  try {
    const line = `[${new Date().toISOString()}] ${message} ${JSON.stringify(meta)}\n`;
    fs.appendFileSync("/tmp/ubuntu-workbench-debug.log", line);
  } catch {}
}

class TerminalService {
  constructor(sendToRenderer, notificationService) {
    this.sendToRenderer = sendToRenderer;
    this.notificationService = notificationService;
    this.sessions = new Map();
  }

  createSession(sessionId, cwd, projectName) {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.cwd = cwd;
      existing.projectName = projectName;
      return {
        sessionId,
        shell: existing.shell,
        cwd,
        home: os.homedir(),
      };
    }

    const shell = process.env.SHELL || "/usr/bin/zsh";
    const ptyProcess = pty.spawn(shell, ["-l"], {
      name: "xterm-256color",
      cols: 120,
      rows: 36,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
      },
    });

    const session = {
      sessionId,
      shell,
      cwd,
      projectName,
      ptyProcess,
      codex: {
        active: false,
        booting: false,
        pendingPrompt: false,
        sawOutputSinceSubmit: false,
        inputBuffer: "",
        recentText: "",
      },
    };

    this.sessions.set(sessionId, session);
    ptyProcess.onData((data) => {
      this.trackCodexOutput(session, data);
      this.sendToRenderer("terminal:data", { sessionId, data });
    });
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.sendToRenderer("terminal:exit", { sessionId, exitCode, signal });
      this.sessions.delete(sessionId);
    });

    return {
      sessionId,
      shell,
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
    }

    if (!this.looksLikeCodexIdle(session.codex.recentText)) {
      return;
    }

    if (session.codex.booting) {
      debugLog("codex:idle:boot-finished", { projectName: session.projectName });
      session.codex.booting = false;
      return;
    }

    if (session.codex.pendingPrompt && session.codex.sawOutputSinceSubmit) {
      debugLog("codex:idle:notify", { projectName: session.projectName });
      this.notificationService?.notifyTerminalTurnFinished(session.projectName || "当前项目");
      session.codex.pendingPrompt = false;
      session.codex.sawOutputSinceSubmit = false;
    }
  }

  looksLikeCodexIdle(text) {
    const tail = String(text || "").slice(-1200);
    return /(?:^|\n)\s*›\s.*$/m.test(tail) && /gpt-[^\n]*\d+% left/.test(tail);
  }

  stripAnsi(value) {
    return value.replace(
      // eslint-disable-next-line no-control-regex
      /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007]*(?:\u0007|\u001b\\)|\u001b[@-_]/g,
      ""
    );
  }
}

module.exports = { TerminalService };
