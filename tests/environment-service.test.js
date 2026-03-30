const test = require("node:test");
const assert = require("node:assert/strict");
const { EnvironmentService } = require("../src/main/services/environment-service");

test("EnvironmentService reports installed command details", () => {
  const service = new EnvironmentService();
  const result = service.inspectCommand("node", ["--version"]);

  assert.equal(result.installed, true);
  assert.match(result.version, /^v\d+/);
});

test("EnvironmentService reports missing command", () => {
  const service = new EnvironmentService();
  const result = service.inspectCommand("definitely-missing-command", ["--version"]);

  assert.equal(result.installed, false);
  assert.equal(result.version, null);
  assert.ok(result.detail);
});

test("EnvironmentService auto-selects the only discovered codex path", () => {
  const service = new EnvironmentService();
  service.findCodexCandidates = () => [
    {
      installed: true,
      version: "codex-cli 0.117.0",
      detail: "ok",
      path: "/opt/codex/bin/codex",
    },
  ];

  const result = service.inspectCodex({});

  assert.equal(result.installed, true);
  assert.equal(result.autoSelectedPath, "/opt/codex/bin/codex");
  assert.equal(result.path, "/opt/codex/bin/codex");
  assert.equal(result.needsSelection, false);
});

test("EnvironmentService requires selection when multiple codex paths are found", () => {
  const service = new EnvironmentService();
  service.findCodexCandidates = () => [
    {
      installed: true,
      version: "codex-cli 0.112.0",
      detail: "ok",
      path: "/usr/local/bin/codex",
    },
    {
      installed: true,
      version: "codex-cli 0.117.0",
      detail: "ok",
      path: "/home/demo/.nvm/bin/codex",
    },
  ];

  const result = service.inspectCodex({});

  assert.equal(result.installed, false);
  assert.equal(result.path, null);
  assert.equal(result.needsSelection, true);
  assert.equal(result.candidates.length, 2);
});
