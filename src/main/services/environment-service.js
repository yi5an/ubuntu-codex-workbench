const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

class EnvironmentService {
  inspect(settings = {}) {
    return {
      codex: this.inspectCodex(settings),
      code: this.inspectCommand("code", ["--version"]),
    };
  }

  inspectCodex(settings = {}) {
    const configuredPath = String(settings?.codex?.path || "").trim();
    const candidates = this.findCodexCandidates();
    const candidateMap = new Map(candidates.map((candidate) => [candidate.path, candidate]));
    const configured = configuredPath
      ? this.inspectExecutable(configuredPath)
      : null;

    if (configured?.installed && !candidateMap.has(configured.path)) {
      candidates.unshift(configured);
      candidateMap.set(configured.path, configured);
    }

    const autoSelectedPath = !configuredPath && candidates.length === 1 ? candidates[0].path : null;
    const selectedPath = configuredPath || autoSelectedPath;
    const selected = selectedPath ? candidateMap.get(selectedPath) || configured : null;

    return {
      installed: Boolean(selected?.installed),
      version: selected?.version || null,
      detail: selected?.detail || (candidates.length > 0 ? "请选择 Codex 路径" : "未找到 codex"),
      path: selectedPath || null,
      configuredPath: configuredPath || null,
      candidates,
      needsSelection: candidates.length > 1 && !configuredPath,
      hasMultipleCandidates: candidates.length > 1,
      autoSelectedPath,
      configuredPathMissing: Boolean(configuredPath && !configured?.installed),
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

  inspectExecutable(executablePath) {
    const inspected = this.inspectCommand(executablePath, ["--version"]);
    return {
      ...inspected,
      path: executablePath,
    };
  }

  findCodexCandidates() {
    const candidates = [];
    const seen = new Set();

    for (const candidatePath of this.findCodexPaths()) {
      const inspected = this.inspectExecutable(candidatePath);
      if (!inspected.installed) {
        continue;
      }

      const identity = this.normalizeCandidateIdentity(candidatePath);
      if (seen.has(identity)) {
        continue;
      }

      seen.add(identity);
      candidates.push(inspected);
    }

    return candidates.sort((a, b) => a.path.localeCompare(b.path));
  }

  findCodexPaths() {
    const paths = new Set();

    for (const pathEntry of this.readPathEntries(process.env.PATH)) {
      const candidate = path.join(pathEntry, "codex");
      if (this.isExecutable(candidate)) {
        paths.add(candidate);
      }
    }

    const shellResult = spawnSync("bash", ["-lc", "which -a codex 2>/dev/null || true"], {
      encoding: "utf8",
      timeout: 5000,
    });
    for (const line of String(shellResult.stdout || "").split("\n")) {
      const candidate = line.trim();
      if (candidate && this.isExecutable(candidate)) {
        paths.add(candidate);
      }
    }

    return [...paths];
  }

  readPathEntries(pathValue) {
    return String(pathValue || "")
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  isExecutable(filePath) {
    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  normalizeCandidateIdentity(filePath) {
    try {
      return fs.realpathSync(filePath);
    } catch {
      return filePath;
    }
  }

  firstNonEmptyLine(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || null;
  }
}

module.exports = { EnvironmentService };
