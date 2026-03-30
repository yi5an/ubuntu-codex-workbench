const { spawnSync } = require("node:child_process");

class EnvironmentService {
  inspect() {
    return {
      codex: this.inspectCommand("codex", ["--version"]),
      code: this.inspectCommand("code", ["--version"]),
    };
  }

  inspectCommand(command, args) {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      timeout: 5000,
    });

    if (result.error) {
      return {
        installed: false,
        version: null,
        detail: result.error.message,
      };
    }

    return {
      installed: result.status === 0,
      version: this.firstNonEmptyLine(result.stdout) || this.firstNonEmptyLine(result.stderr),
      detail: result.status === 0 ? "ok" : `exit code ${result.status}`,
    };
  }

  firstNonEmptyLine(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || null;
  }
}

module.exports = { EnvironmentService };

