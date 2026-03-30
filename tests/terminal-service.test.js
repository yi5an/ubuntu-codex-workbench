const test = require("node:test");
const assert = require("node:assert/strict");
const { TerminalService } = require("../src/main/services/terminal-service");

test("TerminalService notifies when Codex returns to idle after a submitted prompt", () => {
  const notifications = [];
  const service = new TerminalService(() => {}, {
    notifyTerminalTurnFinished(projectName) {
      notifications.push(projectName);
    },
  });

  const session = {
    projectName: "ErrVault",
    codex: {
      active: true,
      booting: true,
      pendingPrompt: false,
      sawOutputSinceSubmit: false,
      inputBuffer: "",
      recentText: "",
    },
  };

  service.trackCodexOutput(session, "› \ngpt-5.4 medium · 100% left · ~/Desktop/project/dev/ErrVault");
  assert.equal(notifications.length, 0);
  assert.equal(session.codex.booting, false);

  service.trackCodexInput(session, "summarize recent commits");
  service.trackCodexInput(session, "\r");
  assert.equal(session.codex.pendingPrompt, true);

  service.trackCodexOutput(session, "Working on it...\n");
  service.trackCodexOutput(session, "› summarize recent commits\ngpt-5.4 medium · 100% left · ~/Desktop/project/dev/ErrVault");

  assert.deepEqual(notifications, ["ErrVault"]);
  assert.equal(session.codex.pendingPrompt, false);
});

test("TerminalService does not notify for empty enter presses", () => {
  const notifications = [];
  const service = new TerminalService(() => {}, {
    notifyTerminalTurnFinished(projectName) {
      notifications.push(projectName);
    },
  });

  const session = {
    projectName: "ErrVault",
    codex: {
      active: true,
      booting: false,
      pendingPrompt: false,
      sawOutputSinceSubmit: false,
      inputBuffer: "",
      recentText: "",
    },
  };

  service.trackCodexInput(session, "\r");
  service.trackCodexOutput(session, "› \ngpt-5.4 medium · 100% left · ~/Desktop/project/dev/ErrVault");

  assert.equal(notifications.length, 0);
});
