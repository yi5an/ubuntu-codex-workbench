const { spawn } = require("node:child_process");

class CodexRunner {
  run({ cwd, prompt, onStdout, onStderr, onClose, onError }) {
    const child = spawn("codex", ["exec", "--color", "never", "--skip-git-repo-check", "-C", cwd, prompt], {
      cwd: process.cwd(),
      env: process.env,
    });

    if (child.stdout) {
      child.stdout.on("data", (chunk) => onStdout(chunk.toString()));
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => onStderr(chunk.toString()));
    }
    child.on("close", (code, signal) => onClose(code, signal));
    child.on("error", (error) => onError(error));

    return child;
  }
}

module.exports = { CodexRunner };
